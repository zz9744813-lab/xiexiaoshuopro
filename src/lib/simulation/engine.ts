/**
 * Simulation engine - simultaneous mode (spec § 19.2).
 *
 * Flow:
 *  1. Generate per-entity perspective contexts (parallel)
 *  2. Call character LLMs in parallel (LLM calls are OUTSIDE the tx so traces
 *     are preserved even on rollback - per spec § 22 / B-2)
 *  3. Run leak detection on each character's output (audit_logs written
 *     OUTSIDE tx so they're preserved on rollback)
 *  4. Call world_agent LLM with character outputs
 *  5. Run post-validation on world_agent output
 *  6. Open a single transaction for all state mutations:
 *     - insert actions / events / memories / memory_write_requests
 *     - update round.status = committed
 *     - if any audit finding has severity=critical, throw RoundAbortedError
 *       to rollback the entire transaction
 *  7. On failure: mark round rolled_back / paused / failed (outside tx),
 *     write summary audit_log, publish event
 */

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  scenes,
  rounds,
  actions,
  events as eventsTable,
  entities as entitiesTable,
  memories as memoriesTable,
  memoryWriteRequests,
  auditLogs,
} from '@/db/schema';
import { generatePerspectiveContext } from '@/lib/context-router';
import { callLLM, BudgetExceededError } from './llm-service';
import { publishEvent } from '@/lib/events/event-bus';
import {
  DEFAULT_CHARACTER_SYSTEM_PROMPT,
  DEFAULT_WORLD_AGENT_SYSTEM_PROMPT,
  wrapUserData,
} from './prompts';
import { detectLeak, extractTokens } from '@/lib/audit/leak-detector';
import { validateEntityStateDelta } from '@/lib/validation/entity-state-delta';
import { registerRound, unregisterRound } from './pause-registry';

export class RoundAbortedError extends Error {
  reason: 'critical_audit' | 'world_agent_failed' | 'unknown';
  findings: Array<{ severity: string; description: string }>;
  constructor(
    reason: 'critical_audit' | 'world_agent_failed' | 'unknown',
    findings: Array<{ severity: string; description: string }>,
    message?: string,
  ) {
    super(message ?? `Round aborted: ${reason}`);
    this.reason = reason;
    this.findings = findings;
  }
}

export interface RunRoundParams {
  worldId: string;
  worldlineId: string;
  sceneId: string;
  participantEntityIds: string[];
  worldAgentEntityId: string;
  publicSceneLog?: Array<{
    fromEntityId?: string;
    spoken_text?: string;
    visible_action?: string;
    observable_clues?: string[];
  }>;
}

export interface RunRoundResult {
  roundId: string;
  status: 'committed' | 'failed' | 'rolled_back' | 'paused';
  actionIds: string[];
  eventIds: string[];
  auditFindings: Array<{ severity: string; description: string }>;
}

interface PreparedAction {
  entityId: string;
  entityName: string;
  actionType: string;
  publicLayer: Record<string, unknown>;
  privateLayer: Record<string, unknown>;
  memoryUpdate: Record<string, unknown>;
  rawModelOutput: Record<string, unknown> | null;
  isFallback: boolean;
}

export async function runRoundSimultaneous(
  params: RunRoundParams,
): Promise<RunRoundResult> {
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

  publishEvent('round.started', {
    worldId: params.worldId,
    worldlineId: params.worldlineId,
    sceneId: params.sceneId,
    roundId: round.id,
    data: { round_index: nextIndex },
  });

  // Register an AbortController so /api/scenes/[id]/pause can cancel us
  const ac = registerRound(round.id);

  const auditFindings: Array<{ severity: string; description: string }> = [];

  try {
    // ---------- LLM Stage (outside any tx) ----------

    // 1. Generate perspective contexts in parallel
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

    // 2. Resolve entity rows
    const charEntities = await Promise.all(
      params.participantEntityIds.map(async (eid) => {
        const [e] = await db
          .select()
          .from(entitiesTable)
          .where(eq(entitiesTable.id, eid));
        return e;
      }),
    );

    // 3. Call character LLMs in parallel
    const characterCalls = await Promise.all(
      charEntities.map(async (entity, idx) => {
        if (!entity || !entity.apiProfileId) return null;
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
              signal: ac.signal,
            },
          );
          return { entity, result };
        } catch (e) {
          return { entity, error: String(e) };
        }
      }),
    );

    // 4. Build prepared actions + run leak detection (audit_logs OUTSIDE tx)
    const prepared: PreparedAction[] = [];
    for (const c of characterCalls) {
      if (!c) continue;
      if ('error' in c && c.error) {
        // spec § 21.4 - silent fallback action
        prepared.push({
          entityId: c.entity!.id,
          entityName: c.entity!.name,
          actionType: 'system_default',
          publicLayer: {
            visible_action: '他沉默了一会儿，没有立刻回应。',
            spoken_text: '',
            tone: '沉默',
          },
          privateLayer: { system_note: c.error },
          memoryUpdate: {},
          rawModelOutput: null,
          isFallback: true,
        });
        continue;
      }
      if (!('result' in c) || !c.result) continue;
      const parsed =
        (c.result.response.parsedJson as Record<string, unknown> | undefined) ?? null;
      if (!parsed) continue;

      const publicLayer = (parsed.public_layer as Record<string, unknown>) ?? {};
      const privateLayer = (parsed.private_layer as Record<string, unknown>) ?? {};
      const publicText = [
        publicLayer.spoken_text,
        publicLayer.visible_action,
        ...(Array.isArray(publicLayer.observable_clues) ? publicLayer.observable_clues : []),
      ]
        .filter(Boolean)
        .join(' ');
      const privateText = [privateLayer.thought, privateLayer.intention]
        .filter(Boolean)
        .join(' ');
      const sensitive = extractTokens(String(privateText));
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
          publicLayer.spoken_text = '[本句因泄漏检测被阻断]';
          publicLayer.observable_clues = [];
        }
      }

      prepared.push({
        entityId: c.entity!.id,
        entityName: c.entity!.name,
        actionType: String(parsed.action_type ?? 'speak_only'),
        publicLayer,
        privateLayer,
        memoryUpdate: (parsed.memory_update as Record<string, unknown>) ?? {},
        rawModelOutput: parsed,
        isFallback: false,
      });
    }

    // 5. Call world_agent (with intermediate "view" of prepared actions)
    const [worldAgent] = await db
      .select()
      .from(entitiesTable)
      .where(eq(entitiesTable.id, params.worldAgentEntityId));
    if (!worldAgent || !worldAgent.apiProfileId) {
      throw new RoundAbortedError(
        'world_agent_failed',
        auditFindings,
        'world_agent has no api_profile',
      );
    }

    // We need action_ids in world_input but actions aren't inserted yet.
    // Use temp ids; world_agent's output references them; we'll remap during persistence.
    const tempIdMap = new Map<string, string>(); // tempId -> entityId
    const worldInput = {
      actions: prepared.map((p) => {
        const tempId = `tmp-${p.entityId.slice(0, 8)}`;
        tempIdMap.set(tempId, p.entityId);
        return {
          action_id: tempId,
          entity_id: p.entityId,
          public_layer: p.publicLayer,
          private_layer: p.privateLayer,
        };
      }),
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
        signal: ac.signal,
      },
    );

    const wparsed = worldCall.response.parsedJson as
      | { round_result?: Record<string, unknown> }
      | undefined;
    const roundResult = wparsed?.round_result ?? {};

    // 6. Post-validate world_agent output (spec § 27)
    const entityStateDeltas =
      (roundResult.entity_state_deltas as Array<{ entity_id: string; changes: unknown }>) ??
      [];
    for (const d of entityStateDeltas) {
      const r = validateEntityStateDelta(d.changes);
      if (!r.ok) {
        const finding = {
          severity: 'error' as const,
          description: `entity_state_delta for ${d.entity_id} forbidden=${r.forbidden.join(',')} unknown=${r.unknown.join(',')}`,
        };
        auditFindings.push(finding);
        await db.insert(auditLogs).values({
          worldId: params.worldId,
          worldlineId: params.worldlineId,
          roundId: round.id,
          sceneId: params.sceneId,
          auditType: 'world_agent_postvalidation',
          severity: 'error',
          description: finding.description,
          payload: { delta: d } as Record<string, unknown>,
        });
      }
    }

    // ---------- Persistence Stage (single transaction) ----------
    const persistResult = await db.transaction(async (tx) => {
      // 7. Insert actions, build tempId → realId map
      const actionRows: Array<typeof actions.$inferSelect> = [];
      const realIdByTempId = new Map<string, string>();
      for (const p of prepared) {
        const [row] = await tx
          .insert(actions)
          .values({
            roundId: round.id,
            sceneId: params.sceneId,
            entityId: p.entityId,
            phase: 'single',
            actionType: p.actionType,
            publicLayer: p.publicLayer,
            privateLayer: p.privateLayer,
            memoryUpdate: p.memoryUpdate,
            rawModelOutput: p.rawModelOutput,
            isFallback: p.isFallback,
            status: 'completed',
          })
          .returning();
        actionRows.push(row);
        const tempId = `tmp-${p.entityId.slice(0, 8)}`;
        realIdByTempId.set(tempId, row.id);
      }

      // 8. Insert events (remap action_ids)
      const publicEvents = (roundResult.public_events as Array<{
        summary: string;
        involved_action_ids?: string[];
        event_level?: string;
        importance?: number;
      }>) ?? [];
      const eventIds: string[] = [];
      for (const ev of publicEvents) {
        const remappedIds = (ev.involved_action_ids ?? [])
          .map((id) => realIdByTempId.get(id) ?? id)
          .filter((id) => actionRows.some((a) => a.id === id));
        const [evRow] = await tx
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
            sourceActionIds: remappedIds,
            importance: (ev.importance ?? 0.5).toString(),
            eventLevel: ev.event_level ?? 'ordinary',
          })
          .returning({ id: eventsTable.id });
        eventIds.push(evRow.id);
      }

      // 9. Memory write requests
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
          await tx.insert(memoryWriteRequests).values({
            worldId: params.worldId,
            worldlineId: params.worldlineId,
            proposedBy,
            proposedPayload: m as Record<string, unknown>,
            sourceTraceId: worldCall.traceId,
            status: 'pending',
          });
        } else {
          await tx.insert(memoriesTable).values({
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

      // 10. Pre-commit critical audit gate (spec § 22.7)
      const criticalCount = auditFindings.filter((f) => f.severity === 'critical').length;
      if (criticalCount > 0) {
        throw new RoundAbortedError(
          'critical_audit',
          auditFindings,
          `${criticalCount} critical audit finding(s) - rolling back round`,
        );
      }

      // 11. Mark round committed (in same tx so it's atomic)
      await tx
        .update(rounds)
        .set({ status: 'committed', completedAt: new Date() })
        .where(eq(rounds.id, round.id));

      return { actionIds: actionRows.map((a) => a.id), eventIds };
    });

    publishEvent('round.committed', {
      worldId: params.worldId,
      worldlineId: params.worldlineId,
      sceneId: params.sceneId,
      roundId: round.id,
      data: {
        action_count: persistResult.actionIds.length,
        event_count: persistResult.eventIds.length,
        audit_findings: auditFindings.length,
      },
    });

    return {
      roundId: round.id,
      status: 'committed',
      actionIds: persistResult.actionIds,
      eventIds: persistResult.eventIds,
      auditFindings,
    };
  } catch (e) {
    const isBudget = e instanceof BudgetExceededError;
    const isAborted = e instanceof RoundAbortedError;
    let newStatus: 'paused' | 'rolled_back' | 'failed' = 'failed';
    let returnStatus: RunRoundResult['status'] = 'failed';
    if (isBudget) {
      newStatus = 'paused';
      returnStatus = 'paused';
    } else if (isAborted) {
      newStatus = 'rolled_back';
      returnStatus = 'rolled_back';
    }

    await db
      .update(rounds)
      .set({ status: newStatus, completedAt: new Date() })
      .where(eq(rounds.id, round.id));

    if (isBudget) {
      await db.insert(auditLogs).values({
        worldId: params.worldId,
        worldlineId: params.worldlineId,
        roundId: round.id,
        sceneId: params.sceneId,
        auditType: 'budget_exceeded',
        severity: 'warning',
        description: e.message,
        actionTaken: 'round_paused',
        payload: { statuses: e.statuses } as Record<string, unknown>,
      });
    }
    if (isAborted) {
      await db.insert(auditLogs).values({
        worldId: params.worldId,
        worldlineId: params.worldlineId,
        roundId: round.id,
        sceneId: params.sceneId,
        auditType: 'round_aborted_by_audit',
        severity: 'critical',
        description: e.message,
        actionTaken: 'transaction_rolled_back',
        payload: { findings: e.findings } as Record<string, unknown>,
      });
    }

    publishEvent('round.rolled_back', {
      worldId: params.worldId,
      worldlineId: params.worldlineId,
      sceneId: params.sceneId,
      roundId: round.id,
      data: { error: String(e), isBudget, isAborted },
    });

    return {
      roundId: round.id,
      status: returnStatus,
      actionIds: [],
      eventIds: [],
      auditFindings: isAborted
        ? e.findings
        : [
            {
              severity: isBudget ? 'warning' : 'critical',
              description: String(e),
            },
          ],
    };
  } finally {
    unregisterRound(round.id);
  }
}
