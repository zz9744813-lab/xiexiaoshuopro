import { NextRequest } from 'next/server';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { scenes, rounds, worlds, auditLogs } from '@/db/schema';
import { ok, badRequest, notFound, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';
import { pauseRound, activeRoundIds } from '@/lib/simulation/pause-registry';
import { publishEvent } from '@/lib/events/event-bus';

/**
 * POST /api/scenes/[id]/pause
 *
 * Sends abort signal to all in-flight rounds belonging to this scene.
 * Per spec § 21.6 / B-3:
 *  - completed in-flight calls keep their traces (completed_after_pause)
 *  - in-progress calls error out as 'aborted' with traces preserved
 *  - queued calls never start
 * Round status is updated by the engine's catch block; this route just
 * triggers the abort.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const auth = await getAuthContext();

    const [scene] = await db.select().from(scenes).where(eq(scenes.id, id));
    if (!scene) return notFound('Scene not found');
    const [world] = await db.select().from(worlds).where(eq(worlds.id, scene.worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    // Find running rounds in this scene
    const running = await db
      .select({ id: rounds.id })
      .from(rounds)
      .where(and(eq(rounds.sceneId, id), eq(rounds.status, 'running')));

    const active = new Set(activeRoundIds());
    const paused: string[] = [];
    for (const r of running) {
      if (active.has(r.id)) {
        const ok = pauseRound(r.id);
        if (ok) paused.push(r.id);
      }
    }

    // Best-effort: also flip any running rounds to status='paused' if no
    // engine instance is currently servicing them (e.g. server restarted).
    const orphanIds = running.filter((r) => !active.has(r.id)).map((r) => r.id);
    if (orphanIds.length > 0) {
      await db
        .update(rounds)
        .set({ status: 'paused' })
        .where(inArray(rounds.id, orphanIds));
    }

    await db.insert(auditLogs).values({
      worldId: scene.worldId,
      worldlineId: scene.worldlineId,
      sceneId: id,
      auditType: 'pause_requested',
      severity: 'info',
      source: auth.userId,
      description: `User requested pause; ${paused.length} active, ${orphanIds.length} orphan`,
      actionTaken: 'abort_signal_sent',
    });

    publishEvent('simulation.paused', {
      worldId: scene.worldId,
      worldlineId: scene.worldlineId,
      sceneId: id,
      data: { pausedRoundIds: paused, orphanRoundIds: orphanIds },
    });

    return ok({
      pausedRoundIds: paused,
      orphanRoundIds: orphanIds,
    });
  } catch (e) {
    return serverError('Pause failed', String(e));
  }
}
