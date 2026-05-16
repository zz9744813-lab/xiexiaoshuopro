/**
 * Hybrid two-phase simulation per spec 19.4 / 19.6.
 *
 * Phase A (intent): all characters output desired_action / planned_speech in parallel
 * Phase B (public): world_agent decides public order, interruptions, who speaks
 *                   then generates actual public_layer
 * Phase B reaction: characters who need to react get a 2nd call seeing only
 *                   already-public content (NOT others' unspoken intent)
 *
 * Hard rules (spec 19.6):
 * - Phase A intents NEVER enter other characters' context
 * - Phase B public actions reference parent_action_id from Phase A
 * - Interrupted planned_speech goes to private_layer + private memory only
 * - reaction phase characters see only public spoken_text, not other unspoken intent
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
import {
  DEFAULT_CHARACTER_SYSTEM_PROMPT,
  DEFAULT_WORLD_AGENT_SYSTEM_PROMPT,
  wrapUserData,
} from './prompts';
import { detectLeak, extractTokens } from '@/lib/audit/leak-detector';
import { publishEvent } from '@/lib/events/event-bus';

const PHASE_A_INTENT_PROMPT = `${DEFAULT_CHARACTER_SYSTEM_PROMPT}

【Phase A 特殊说明】
当前阶段是意图阶段。请按角色 JSON Schema 输出，但要清楚意识到：
- public_layer.spoken_text 视为"你打算说出口的台词"，可能被打断
- public_layer.visible_action 视为"你打算做的动作"
- private_layer.intention 必须明确写出你这一轮的核心意图
你的意图不会立即变成公开事实；主世界会根据所有人的意图决定公开顺序、谁先说、谁被打断。
`;

const PHASE_B_WORLD_PROMPT = `${DEFAULT_WORLD_AGENT_SYSTEM_PROMPT}

【Phase B 特殊说明】
你已经看到所有角色的 Phase A 意图。请决定：
1. 公开顺序（谁先说、谁先动）
2. 是否有人打断别人，被打断者的 planned_speech 不会成为公开事实
3. 即时反应（哪些角色需要触发 reaction）
4. 输出 round_result，其中 public_events 必须 reference 各角色 Phase A 的 action_id（即 involved_action_ids）

你不能把 Phase A 的 private_layer 直接复制成 public_events 内容。
`;

export interface HybridRoundParams {
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

export interface HybridRoundResult {
  roundId: string;
  status: 'committed' | 'failed' | 'rolled_back';
  intentActionIds: string[];
  publicActionIds: string[];
  reactionActionIds: string[];
  eventIds: string[];
  auditFindings: Array<{ severity: string; description: string }>;
}

export async function runRoundHybrid(params: HybridRoundParams): Promise<HybridRoundResult> {
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
      mode: 'hybrid_two_phase',
      status: 'running',
      startedAt: new Date(),
    })
    .returning();

  publishEvent('round.started', {
    worldId: params.worldId,
    worldlineId: params.worldlineId,
    sceneId: params.sceneId,
    roundId: round.id,
    data: { mode: 'hybrid_two_phase' },
  });

  const auditFindings: HybridRoundResult['auditFindings'] = [];
  const intentActionIds: string[] = [];
  const publicActionIds: string[] = [];
  const reactionActionIds: string[] = [];
  const eventIds: string[] = [];

  try {
    // ===== Phase A: Intent =====
    publishEvent('phase.started', {
      worldId: params.worldId,
      roundId: round.id,
      sceneId: params.sceneId,
      worldlineId: params.worldlineId,
      phase: 'intent',
    });

    const charEntities = await Promise.all(
      params.participantEntityIds.map(async (eid) => {
        const [e] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, eid));
        return e;
      }),
    );

    const phaseAResults = await Promise.all(
      charEntities.map(async (entity) => {
        if (!entity || !entity.apiProfileId) return null;
        const ctx = await generatePerspectiveContext({
          worldId: params.worldId,
          worldlineId: params.worldlineId,
          sceneId: params.sceneId,
          roundId: round.id,
          targetEntityId: entity.id,
          publicSceneLog: params.publicSceneLog,
        });
        try {
          const result = await callLLM(
            [
              { role: 'system', content: PHASE_A_INTENT_PROMPT },
              { role: 'user', content: wrapUserData('perspective_context', ctx.perspectiveContext) },
            ],
            {
              apiProfileId: entity.apiProfileId,
              worldId: params.worldId,
              worldlineId: params.worldlineId,
              sceneId: params.sceneId,
              roundId: round.id,
              entityId: entity.id,
              traceType: 'character_call',
              phase: 'intent',
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

    // Persist intent actions
    const intentActions: Array<{ id: string; entityId: string; data: Record<string, unknown> }> = [];
    for (const r of phaseAResults) {
      if (!r) continue;
      if ('error' in r && r.error) {
        const [row] = await db
          .insert(actions)
          .values({
            roundId: round.id,
            sceneId: params.sceneId,
            entityId: r.entity!.id,
            phase: 'intent',
            actionType: 'system_default',
            publicLayer: { visible_action: '他沉默着，没有显露任何意图。', spoken_text: '' },
            privateLayer: { system_note: r.error },
            isFallback: true,
            status: 'completed',
          })
          .returning({ id: actions.id });
        intentActions.push({ id: row.id, entityId: r.entity!.id, data: {} });
        intentActionIds.push(row.id);
        continue;
      }
      if (!('result' in r) || !r.result) continue;
      const parsed = (r.result.response.parsedJson as Record<string, unknown>) ?? {};
      const [row] = await db
        .insert(actions)
        .values({
          roundId: round.id,
          sceneId: params.sceneId,
          entityId: r.entity!.id,
          phase: 'intent',
          actionType: String(parsed.action_type ?? 'speak_only'),
          actionIntent: (parsed.private_layer as Record<string, unknown>) ?? {},
          publicLayer: (parsed.public_layer as Record<string, unknown>) ?? {},
          privateLayer: (parsed.private_layer as Record<string, unknown>) ?? {},
          memoryUpdate: (parsed.memory_update as Record<string, unknown>) ?? {},
          rawModelOutput: parsed,
          status: 'completed',
        })
        .returning({ id: actions.id });
      intentActions.push({ id: row.id, entityId: r.entity!.id, data: parsed });
      intentActionIds.push(row.id);
    }

    // ===== Phase B: World agent decides public outcome =====
    publishEvent('phase.started', {
      worldId: params.worldId,
      roundId: round.id,
      sceneId: params.sceneId,
      worldlineId: params.worldlineId,
      phase: 'public',
    });

    const [worldAgent] = await db
      .select()
      .from(entitiesTable)
      .where(eq(entitiesTable.id, params.worldAgentEntityId));
    if (!worldAgent || !worldAgent.apiProfileId) {
      throw new Error('world_agent has no api_profile');
    }

    const worldInput = {
      intents: intentActions.map((a) => ({
        action_id: a.id,
        entity_id: a.entityId,
        intent_data: a.data, // includes private_layer.intention + public_layer planned content
      })),
      scene_id: params.sceneId,
      round_id: round.id,
      instructions:
        '决定公开顺序、打断、interruption。对每一个 Phase A action，输出对应的 public 结果（spoken_text/visible_action）。被打断者的 planned_speech 不进入 public_events，但要在 private_events 中标注。',
    };

    const worldCall = await callLLM(
      [
        { role: 'system', content: PHASE_B_WORLD_PROMPT },
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
        phase: 'public',
        schemaName: 'worldAgent',
        inputContext: worldInput,
      },
    );

    const wparsed = worldCall.response.parsedJson as
      | { round_result?: Record<string, unknown> }
      | undefined;
    const roundResult = wparsed?.round_result ?? {};

    // World agent should output public_events that map to intentActions.
    // For each intent action, produce a public action row.
    // We expect the world_agent to fill an `interruption_decisions` field;
    // since spec is flexible, we apply a conservative default: each intent
    // becomes a public action unless world_agent says it was interrupted.

    const interruptionDecisions = (roundResult.interruption_decisions as Array<{
      intent_action_id: string;
      was_interrupted?: boolean;
      final_spoken_text?: string;
      final_visible_action?: string;
    }>) ?? [];

    const decisionMap = new Map(interruptionDecisions.map((d) => [d.intent_action_id, d]));

    for (const intent of intentActions) {
      const decision = decisionMap.get(intent.id);
      const intentPublic = (intent.data.public_layer as Record<string, string>) ?? {};
      const intentPrivate = (intent.data.private_layer as Record<string, unknown>) ?? {};

      const wasInterrupted = decision?.was_interrupted ?? false;
      const finalSpoken = wasInterrupted
        ? '' // interrupted speech doesn't enter public
        : (decision?.final_spoken_text ?? intentPublic.spoken_text ?? '');
      const finalAction = decision?.final_visible_action ?? intentPublic.visible_action ?? '';

      // Run leak detection on final public_layer
      const privateText = [intentPrivate.thought, intentPrivate.intention]
        .filter(Boolean)
        .join(' ');
      const sensitive = extractTokens(String(privateText));
      const publicText = `${finalSpoken} ${finalAction}`.trim();
      const leak = detectLeak({
        privateLayerText: String(privateText),
        publicLayerText: publicText,
        sensitiveEntities: sensitive,
      });
      let safeFinalSpoken = finalSpoken;
      let safeFinalAction = finalAction;
      if (leak.severity === 'error' || leak.severity === 'critical') {
        safeFinalSpoken = '[本句因泄漏检测被阻断]';
        safeFinalAction = '';
        await db.insert(auditLogs).values({
          worldId: params.worldId,
          worldlineId: params.worldlineId,
          roundId: round.id,
          sceneId: params.sceneId,
          auditType: 'leak_detection',
          severity: leak.severity,
          source: intent.entityId,
          description: leak.reasons.join('; '),
        });
        auditFindings.push({ severity: leak.severity, description: leak.reasons.join('; ') });
      }

      const [pubRow] = await db
        .insert(actions)
        .values({
          roundId: round.id,
          sceneId: params.sceneId,
          entityId: intent.entityId,
          phase: 'public',
          parentActionId: intent.id,
          actionType: wasInterrupted ? 'wait' : String(intent.data.action_type ?? 'speak_only'),
          publicLayer: {
            spoken_text: safeFinalSpoken,
            visible_action: safeFinalAction,
          },
          // Per spec 19.6.3: interrupted planned_speech goes to private only
          privateLayer: wasInterrupted
            ? {
                ...intentPrivate,
                planned_but_unspoken: intentPublic.spoken_text ?? '',
              }
            : intentPrivate,
          memoryUpdate: {},
          wasInterrupted,
          status: 'completed',
        })
        .returning({ id: actions.id });
      publicActionIds.push(pubRow.id);
    }

    // Insert events from world_agent output
    const publicEvents = (roundResult.public_events as Array<{
      summary: string;
      involved_action_ids?: string[];
      event_level?: string;
      importance?: number;
    }>) ?? [];
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

    // Memory write requests (same as simultaneous mode)
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

    // Mark round committed
    await db
      .update(rounds)
      .set({ status: 'committed', completedAt: new Date() })
      .where(eq(rounds.id, round.id));

    publishEvent('round.committed', {
      worldId: params.worldId,
      worldlineId: params.worldlineId,
      sceneId: params.sceneId,
      roundId: round.id,
      data: {
        mode: 'hybrid_two_phase',
        intent_count: intentActionIds.length,
        public_count: publicActionIds.length,
        reaction_count: reactionActionIds.length,
        event_count: eventIds.length,
      },
    });

    return {
      roundId: round.id,
      status: 'committed',
      intentActionIds,
      publicActionIds,
      reactionActionIds,
      eventIds,
      auditFindings,
    };
  } catch (e) {
    const isBudget = e instanceof BudgetExceededError;
    const newStatus = isBudget ? 'paused' : 'failed';
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
    publishEvent('round.rolled_back', {
      worldId: params.worldId,
      worldlineId: params.worldlineId,
      sceneId: params.sceneId,
      roundId: round.id,
      data: { error: String(e), isBudget },
    });
    return {
      roundId: round.id,
      status: isBudget ? 'rolled_back' : 'failed',
      intentActionIds: [],
      publicActionIds: [],
      reactionActionIds: [],
      eventIds: [],
      auditFindings: [
        {
          severity: isBudget ? 'warning' : 'critical',
          description: String(e),
        },
      ],
    };
  }
}
