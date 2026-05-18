/**
 * Continuous simulation runner.
 *
 * Loops runRoundSimultaneous / runRoundHybrid until a stop condition fires:
 *  - user_stop      : DB simulation_runs.status set to 'stopping' externally
 *  - max_rounds     : totalRounds >= maxRounds (NULL means unlimited)
 *  - max_cost       : totalCostUsd >= maxCostUsd (NULL means unlimited)
 *  - scene_ended    : world_agent emitted scene_ended=true
 *  - stagnation     : consecutiveEmptyRounds >= stagnationThreshold (NULL ignores)
 *  - error          : unhandled exception
 *
 * The runner polls DB status every iteration so an HTTP /stop request
 * can stop it cleanly between rounds. To abort an in-flight LLM call
 * mid-round we still rely on pause-registry.pauseRound(roundId).
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  simulationRuns,
  rounds,
  scenes,
  entities as entitiesTable,
  costLogs,
  events as eventsTable,
} from '@/db/schema';
import { runRoundSimultaneous, RoundAbortedError } from './engine';
import { runRoundHybrid } from './engine-hybrid';
import { publishEvent } from '@/lib/events/event-bus';
import { pauseRound } from './pause-registry';

const POLL_STATUS_EVERY_MS = 200;

export interface StartRunOptions {
  sceneId: string;
  mode?: 'simultaneous' | 'hybrid_two_phase';
  maxRounds?: number | null;
  maxCostUsd?: number | null;
  roundDelayMs?: number;
  stagnationThreshold?: number | null;
}

export interface RunnerSnapshot {
  runId: string;
  status: string;
  totalRounds: number;
  totalCostUsd: number;
  stopReason: string | null;
  errorMessage: string | null;
}

async function loadRun(runId: string) {
  const [r] = await db.select().from(simulationRuns).where(eq(simulationRuns.id, runId));
  return r;
}

async function patchRun(runId: string, patch: Record<string, unknown>) {
  await db
    .update(simulationRuns)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(simulationRuns.id, runId));
}

async function aggregateRunCost(runId: string): Promise<number> {
  const result = await db.execute(
    sql`SELECT COALESCE(SUM(c.cost_usd), 0)::numeric AS total
        FROM cost_logs c
        JOIN rounds r ON r.id = c.round_id
        WHERE r.simulation_run_id = ${runId}`,
  );
  // drizzle returns array of rows
  const rows = (result as unknown as { rows?: Array<{ total: string }> }).rows
    ?? (result as unknown as Array<{ total: string }>);
  const first = Array.isArray(rows) ? rows[0] : undefined;
  return first ? Number(first.total ?? 0) : 0;
}

async function detectSceneEnded(runId: string): Promise<boolean> {
  // world_agent publishes scene_ended via events table (type='scene.ended' or via event-bus)
  // We persist it as a row in `events` if engine pushes it; otherwise rely on
  // a metadata flag. For MVP we look at recent rounds for scene.ended event.
  const r = await db.execute(
    sql`SELECT COUNT(*)::int AS n
        FROM events
        WHERE event_type = 'scene.ended'
          AND scene_id = (SELECT scene_id FROM simulation_runs WHERE id = ${runId})`,
  );
  const rows = (r as unknown as { rows?: Array<{ n: number }> }).rows
    ?? (r as unknown as Array<{ n: number }>);
  const first = Array.isArray(rows) ? rows[0] : undefined;
  return Boolean(first && Number(first.n) > 0);
}

/**
 * Long-running async function. Caller (BullMQ worker or detached
 * route handler) MUST not await this with a short HTTP timeout.
 */
export async function runContinuous(runId: string): Promise<RunnerSnapshot> {
  let run = await loadRun(runId);
  if (!run) throw new Error(`simulation_run ${runId} not found`);

  const [scene] = await db.select().from(scenes).where(eq(scenes.id, run.sceneId));
  if (!scene) throw new Error('scene not found');
  const allEntities = await db
    .select()
    .from(entitiesTable)
    .where(eq(entitiesTable.worldId, run.worldId));
  const worldAgent = allEntities.find((e) => e.entityType === 'world_agent');
  if (!worldAgent) throw new Error('No world_agent entity in this world');

  await patchRun(runId, { status: 'running' });
  publishEvent('simulation.started', {
    worldId: run.worldId,
    worldlineId: run.worldlineId,
    sceneId: run.sceneId,
    data: { runId, mode: run.mode, maxRounds: run.maxRounds, maxCostUsd: run.maxCostUsd },
  });

  const params = {
    worldId: run.worldId,
    worldlineId: run.worldlineId,
    sceneId: run.sceneId,
    participantEntityIds: scene.participantEntityIds ?? [],
    worldAgentEntityId: worldAgent.id,
  };

  let stopReason: string | null = null;
  let errorMessage: string | null = null;

  try {
    while (true) {
      // refresh state
      run = await loadRun(runId);
      if (!run) {
        stopReason = 'user_stop';
        break;
      }
      if (run.status === 'stopping' || run.status === 'paused') {
        stopReason = 'user_stop';
        break;
      }

      // brakes: max rounds
      if (run.maxRounds != null && run.totalRounds >= run.maxRounds) {
        stopReason = 'max_rounds';
        break;
      }

      // brakes: max cost
      if (run.maxCostUsd != null) {
        const cost = await aggregateRunCost(runId);
        await patchRun(runId, { totalCostUsd: cost.toFixed(4) });
        if (cost >= Number(run.maxCostUsd)) {
          stopReason = 'max_cost';
          break;
        }
      }

      // run one round
      let result;
      try {
        result =
          run.mode === 'hybrid_two_phase'
            ? await runRoundHybrid(params)
            : await runRoundSimultaneous(params);
      } catch (e) {
        if (e instanceof RoundAbortedError) {
          // Treat critical aborts as natural stop (round was rolled back)
          publishEvent('round.rolled_back', {
            worldId: run.worldId,
            sceneId: run.sceneId,
            data: { reason: e.reason, runId },
          });
          // continue loop unless user wants to stop on first audit failure
        } else {
          throw e;
        }
      }

      // attach round to run
      if (result?.roundId) {
        await db
          .update(rounds)
          .set({ simulationRunId: runId })
          .where(eq(rounds.id, result.roundId));
      }

      // Hard-stop on engine-level failure (schema_error, infra error, etc).
      // We do NOT keep grinding through more rounds on top of a broken pipeline.
      if (result && result.status === 'failed') {
        const findingDesc = result.auditFindings?.[0]?.description ?? 'unknown engine error';
        stopReason = 'error';
        errorMessage = 'Round failed: ' + findingDesc;
        break;
      }

      // count: how many actions did this round produce?
      function actionsCount(res: unknown): number {
        if (!res || typeof res !== 'object') return 0;
        const r = res as Record<string, unknown>;
        if (Array.isArray(r.actionIds)) return r.actionIds.length;
        const a = Array.isArray(r.intentActionIds) ? r.intentActionIds.length : 0;
        const b = Array.isArray(r.publicActionIds) ? r.publicActionIds.length : 0;
        const c = Array.isArray(r.reactionActionIds) ? r.reactionActionIds.length : 0;
        return a + b + c;
      }
      const empty = !result || actionsCount(result) === 0;
      const newConsec = empty ? (run.consecutiveEmptyRounds ?? 0) + 1 : 0;

      await patchRun(runId, {
        totalRounds: (run.totalRounds ?? 0) + 1,
        consecutiveEmptyRounds: newConsec,
      });

      publishEvent('round.committed', {
        worldId: run.worldId,
        sceneId: run.sceneId,
        roundId: result?.roundId,
        data: {
          runId,
          totalRounds: (run.totalRounds ?? 0) + 1,
          empty,
        },
      });

      // brakes: stagnation
      if (run.stagnationThreshold != null && newConsec >= run.stagnationThreshold) {
        stopReason = 'stagnation';
        break;
      }

      // brakes: scene_ended
      if (await detectSceneEnded(runId)) {
        stopReason = 'scene_ended';
        break;
      }

      // round delay
      const delay = run.roundDelayMs ?? 0;
      if (delay > 0) {
        const start = Date.now();
        while (Date.now() - start < delay) {
          const cur = await loadRun(runId);
          if (cur && (cur.status === 'stopping' || cur.status === 'paused')) {
            stopReason = 'user_stop';
            break;
          }
          await new Promise((res) => setTimeout(res, Math.min(POLL_STATUS_EVERY_MS, delay)));
        }
        if (stopReason) break;
      }
    }
  } catch (e) {
    stopReason = 'error';
    errorMessage = e instanceof Error ? e.message : String(e);
  }

  // Final status
  const finalStatus =
    stopReason === 'error'
      ? 'failed'
      : stopReason === 'scene_ended'
        ? 'finished'
        : 'stopped';

  await patchRun(runId, {
    status: finalStatus,
    stopReason,
    errorMessage,
    endedAt: new Date(),
    totalCostUsd: (await aggregateRunCost(runId)).toFixed(4),
  });

  const final = await loadRun(runId);
  publishEvent(
    finalStatus === 'finished' ? 'scene.completed' : 'simulation.paused',
    {
      worldId: run!.worldId,
      sceneId: run!.sceneId,
      data: {
        runId,
        status: finalStatus,
        stopReason,
        totalRounds: final?.totalRounds ?? 0,
        totalCostUsd: final?.totalCostUsd ?? '0',
      },
    },
  );

  return {
    runId,
    status: finalStatus,
    totalRounds: final?.totalRounds ?? 0,
    totalCostUsd: Number(final?.totalCostUsd ?? 0),
    stopReason,
    errorMessage,
  };
}

/**
 * Mark a run as 'stopping' - the runner loop will detect this between
 * rounds and exit cleanly. Also try to abort any in-flight round LLM call.
 */
export async function requestStop(runId: string): Promise<boolean> {
  const r = await loadRun(runId);
  if (!r) return false;
  if (r.status === 'stopped' || r.status === 'finished' || r.status === 'failed') return false;

  await patchRun(runId, { status: 'stopping' });

  // abort the most recent in-flight round, if any
  const recent = await db
    .select({ id: rounds.id })
    .from(rounds)
    .where(eq(rounds.simulationRunId, runId))
    .orderBy(sql`created_at DESC`)
    .limit(1);
  if (recent[0]) pauseRound(recent[0].id);

  return true;
}