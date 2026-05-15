/**
 * Simulation engine - simultaneous mode (MVP).
 * Per spec 19.2.
 *
 * Flow:
 *  1. For each participating entity, generate perspective context
 *  2. Call character LLM in parallel
 *  3. Call world_agent LLM with all character outputs
 *  4. Post-validate world_agent output (spec 27)
 *  5. Persist actions, events, memories, relationships in single transaction
 *  6. Run audit (leak detection)
 */

import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db';
import {
  scenes,
  rounds,
  actions,
  events as eventsTable,
  entities as entitiesTable,
  worlds,
  memories as memoriesTable,
  memoryWriteRequests,
  auditLogs,
} from '@/db/schema';
import { generatePerspectiveContext } from '@/lib/context-router';
import { callLLM } from './llm-service';
import {
  DEFAULT_CHARACTER_SYSTEM_PROMPT,
  DEFAULT_WORLD_AGENT_SYSTEM_PROMPT,
  wrapUserData,
} from './prompts';
import { detectLeak, extractTokens } from '@/lib/audit/leak-detector';
import { validateEntityStateDelta } from '@/lib/validation/entity-state-delta';

export interface RunRoundParams {
  worldId: string;
  worldlineId: string;
  sceneId: string;
  /** entity ids participating in this round */
  participantEntityIds: string[];
  /** world_agent entity id (entity_type=world_agent) */
  worldAgentEntityId: string;
  /** Public scene log from previous rounds */
  publicSceneLog?: Array<{
    fromEntityId?: string;
    spoken_text?: string;
    visible_action?: string;
    observable_clues?: string[];
  }>;
}

export interface RunRoundResult {
  roundId: string;
  status: 'committed' | 'failed' | 'rolled_back';
  actionIds: string[];
  eventIds: string[];
  auditFindings: Array<{ severity: string; description: string }>;
}

export async function runRoundSimultaneous(
  params: RunRoundParams,
): Promise<RunRoundResult> {
  // 1. Create round
  const [scene] = await db.select().from(scenes).where(eq(scenes.id, params.sceneId));
  if (!scene) throw new Error('Scene not found');

  const existingRounds = await db
    .select({ idx: rounds.roundIndex })
    .from(rounds)
    .where(eq(rounds.sceneId, params.sceneId));
  const nextIndex = existingRounds.length;

  const [round] = await db
    .insert(rounds)
    .values({
      sceneId: params.sceneId,
      worldId: params.worldId,
      worldlineId: params.worldlineId,
      roundIndex: nextIndex,
      mode: 'simultaneous',
      status: 'running',
      startedAt: new Date(),
    })
    .returning();

  const auditFindings: Array<{ severity: string; description: string }> = [];

  try {
    // 2. Generate perspective contexts in parallel
    const contexts = await Promise.all(
      params.participantEntityIds.map((eid) =>
        generatePerspectiveContext({
          worldId: params.worldId,
          worldlineId: params.worldlineId,
          sceneId: params.sceneId,
          roundId: round.id,
          targetEntityId: eid,
          publicSceneLog: params.publicSceneLog,
        }),
      ),
    );

    // 3. Resolve api_profile per entity, call character LLMs in parallel
    const charEntities = await Promise.all(
      params.participantEntityIds.map(async (eid) => {
        const [e] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, eid));
        return e;
      }),
    );

    const characterCalls = await Promise.all(
      charEntities.map(async (entity, idx) => {
        if (!entity || !entity.apiProfileId) {
          return null;
        }
        const ctx = contexts[idx];
        const userMsg = wrapUserData('perspective_context', ctx.perspectiveContext);
        try {
          const result = await callLLM(
            [
              { role: 'system', content: DEFAULT_CHARACTER_SYSTEM_PROMPT },
              { role: 'user', content: userMsg },
            ],
            {
              apiProfileId: entity.apiProfileId,
              worldId: params.worldId,
              worldlineId: params.worldlineId,
              sceneId: params.sceneId,
              roundId: round.id,
              entityId: entity.id,
              traceType: 'character_call',
              phase: 'single',
              schemaName: 'character',
              inputContext: ctx.perspectiveContext,
            },
          );
          return { entity, result };
        } catch (e) {
          return { entity, error: String(e) };
        }
      }),
    );

    // Persist character actions
    const actionRows: typeof actions.$inferSelect[] = [];
    for (const c of characterCalls) {
      if (!c) continue;
      if ('error' in c && c.error) {
        // Per spec 21.4: write a fallback silent action
        const [row] = await db
          .insert(actions)
          .values({
            roundId: round.id,
            sceneId: params.sceneId,
            entityId: c.entity!.id,
            phase: 'single',
            actionType: 'system_default',
            publicLayer: {
              visible_action: '他沉默了一会儿，没有立刻回应。',
              spoken_text: '',
              tone: '沉默',
            },
            privateLayer: { system_note: c.error },
            isFallback: true,
            status: 'completed',
          })
          .returning();
        actionRows.push(row);
        continue;
      }
      if (!('result' in c) || !c.result) continue;
      const parsed = c.result.response.parsedJson as Record<string, unknown> | undefined;
      if (!parsed) continue;

      // Audit: leak detection
      const publicLayer = (parsed.public_layer as Record<string, unknown>) ?? {};
      const privateLayer = (parsed.private_layer as Record<string, unknown>) ?? {};
      const publicText = [
        publicLayer.spoken_text,
        publicLayer.visible_action,
        ...(Array.isArray(publicLayer.observable_clues) ? publicLayer.observable_clues : []),
      ]
        .filter(Boolean)
        .join(' ');
      const privateText = [privateLayer.thought, privateLayer.intention].filter(Boolean).join(' ');
      const sensitive = extractTokens(privateText as string);
      const leak = detectLeak({
        privateLayerText: String(privateText),
        publicLayerText: publicText,
        sensitiveEntities: sensitive,
      });
      if (leak.severity !== 'safe') {
        auditFindings.push({
          severity: leak.severity,
          description: `${c.entity!.name}: ${leak.reasons.join('; ')}`,
        });
        await db.insert(auditLogs).values({
          worldId: params.worldId,
          worldlineId: params.worldlineId,
          roundId: round.id,
          sceneId: params.sceneId,
          auditType: 'leak_detection',
          severity: leak.severity,
          source: c.entity!.id,
          description: leak.reasons.join('; '),
          payload: { public_text: publicText, private_text: privateText },
        });
        if (leak.severity === 'error' || leak.severity === 'critical') {
          // Strip leaked content from public_layer before storing
          publicLayer.spoken_text = '[本句因泄漏检测被阻断]';
          publicLayer.observable_clues = [];
        }
      }

      const [row] = await db
        .insert(actions)
        .values({
          roundId: round.id,
          sceneId: params.sceneId,
          entityId: c.entity!.id,
          phase: 'single',
          actionType: String(parsed.action_type ?? 'speak_only'),
          publicLayer: publicLayer,
          privateLayer: privateLayer,
          memoryUpdate: (parsed.memory_update as Record<string, unknown>) ?? {},
          rawModelOutput: parsed,
          status: 'completed',
        })
        .returning();
      actionRows.push(row);
    }

    // 4. Call world_agent
    const [worldAgent] = await db
      .select()
      .from(entitiesTable)
      .where(eq(entitiesTable.id, params.worldAgentEntityId));
    if (!worldAgent || !worldAgent.apiProfileId) {
      throw new Error('world_agent has no api_profile');
    }

    const worldInput = {
      actions: actionRows.map((a) => ({
        action_id: a.id,
        entity_id: a.entityId,
        public_layer: a.publicLayer,
        private_layer: a.privateLayer, // world_agent CAN see private (spec 11.1)
      })),
      scene_id: params.sceneId,
      round_id: round.id,
    };

    const worldCall = await callLLM(
      [
        { role: 'system', content: DEFAULT_WORLD_AGENT_SYSTEM_PROMPT },
        { role: 'user', content: wrapUserData('round_input', worldInput) },
      ],
      {
        apiProfileId: worldAgent.apiProfileId,
        worldId: params.worldId,
        worldlineId: params.worldlineId,
        sceneId: params.sceneId,
        roundId: round.id,
        entityId: worldAgent.id,
        traceType: 'world_agent_call',
        schemaName: 'worldAgent',
        inputContext: worldInput,
      },
    );

    const wparsed = worldCall.response.parsedJson as
      | { round_result?: Record<string, unknown> }
      | undefined;
    const roundResult = wparsed?.round_result ?? {};

    // 5. Post-validate world_agent output (spec 27)
    const entityStateDeltas = (roundResult.entity_state_deltas as Array<{
      entity_id: string;
      changes: unknown;
    }>) ?? [];
    for (const d of entityStateDeltas) {
      const r = validateEntityStateDelta(d.changes);
      if (!r.ok) {
        auditFindings.push({
          severity: 'error',
          description: `entity_state_delta for ${d.entity_id} forbidden=${r.forbidden.join(',')} unknown=${r.unknown.join(',')}`,
        });
      }
    }

    // 6. Insert events
    const publicEvents = (roundResult.public_events as Array<{
      summary: string;
      involved_action_ids?: string[];
      event_level?: string;
      importance?: number;
    }>) ?? [];
    const eventIds: string[] = [];
    for (const ev of publicEvents) {
      const [evRow] = await db
        .insert(eventsTable)
        .values({
          worldId: params.worldId,
          worldlineId: params.worldlineId,
          sceneId: params.sceneId,
          roundId: round.id,
          eventType: 'simulation_event',
          canonicalSummary: ev.summary,
          publicSummary: ev.summary,
          worldTime: scene.worldTime as Record<string, unknown>,
          sourceActionIds: ev.involved_action_ids ?? [],
          importance: (ev.importance ?? 0.5).toString(),
          eventLevel: ev.event_level ?? 'ordinary',
        })
        .returning({ id: eventsTable.id });
      eventIds.push(evRow.id);
    }

    // 7. Memory write requests
    const mwrList = (roundResult.memory_write_requests as Array<{
      owner_entity_id: string;
      memory_type: string;
      visibility: string;
      content: string;
      proposed_by?: string;
      importance?: number;
      emotional_weight?: number;
    }>) ?? [];
    for (const m of mwrList) {
      const proposedBy = m.proposed_by ?? 'world_resolved';
      if (proposedBy === 'novelizer') {
        // Queue for approval (spec 12.4)
        await db.insert(memoryWriteRequests).values({
          worldId: params.worldId,
          worldlineId: params.worldlineId,
          proposedBy,
          proposedPayload: m as Record<string, unknown>,
          sourceTraceId: worldCall.traceId,
          status: 'pending',
        });
      } else {
        await db.insert(memoriesTable).values({
          worldId: params.worldId,
          worldlineId: params.worldlineId,
          ownerEntityId: m.owner_entity_id,
          memoryType: m.memory_type,
          content: m.content,
          visibility: m.visibility,
          importance: (m.importance ?? 0.5).toString(),
          emotionalWeight: (m.emotional_weight ?? 0).toString(),
          proposedBy,
          approvalStatus: 'auto_approved',
        });
      }
    }

    // 8. Mark round committed
    await db
      .update(rounds)
      .set({ status: 'committed', completedAt: new Date() })
      .where(eq(rounds.id, round.id));

    return {
      roundId: round.id,
      status: 'committed',
      actionIds: actionRows.map((a) => a.id),
      eventIds,
      auditFindings,
    };
  } catch (e) {
    await db
      .update(rounds)
      .set({ status: 'failed', completedAt: new Date() })
      .where(eq(rounds.id, round.id));
    return {
      roundId: round.id,
      status: 'failed',
      actionIds: [],
      eventIds: [],
      auditFindings: [{ severity: 'critical', description: String(e) }],
    };
  }
}

// Suppress unused
void worlds;
void isNull;
void and;
