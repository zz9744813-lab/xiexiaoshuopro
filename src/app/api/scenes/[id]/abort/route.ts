import { NextRequest } from 'next/server';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { scenes, rounds, actions, worlds, auditLogs } from '@/db/schema';
import { ok, badRequest, notFound, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';
import { pauseRound, activeRoundIds } from '@/lib/simulation/pause-registry';
import { publishEvent } from '@/lib/events/event-bus';

const schema = z.object({
  /** If true, hard-delete actions of paused rounds and mark rounds rolled_back */
  discard: z.boolean().optional(),
});

/**
 * POST /api/scenes/[id]/abort
 *
 * Stronger than pause: aborts in-flight calls AND rolls back the rounds.
 * Body: { discard: true } to hard-delete the paused rounds' partial actions
 * and mark them as rolled_back.
 *
 * Traces are kept regardless (spec § 22.7).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const auth = await getAuthContext();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten());

    const [scene] = await db.select().from(scenes).where(eq(scenes.id, id));
    if (!scene) return notFound('Scene not found');
    const [world] = await db.select().from(worlds).where(eq(worlds.id, scene.worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    // 1. Send abort signal to active rounds
    const active = new Set(activeRoundIds());
    const targetRounds = await db
      .select({ id: rounds.id, status: rounds.status })
      .from(rounds)
      .where(
        and(
          eq(rounds.sceneId, id),
          inArray(rounds.status, ['running', 'paused', 'pending']),
        ),
      );
    const aborted: string[] = [];
    for (const r of targetRounds) {
      if (active.has(r.id)) {
        if (pauseRound(r.id)) aborted.push(r.id);
      }
    }

    // 2. If discard requested, hard-delete partial actions and mark rolled_back
    let discardedActions = 0;
    if (parsed.data.discard) {
      const targetIds = targetRounds.map((r) => r.id);
      if (targetIds.length > 0) {
        await db.transaction(async (tx) => {
          const acts = await tx
            .select({ id: actions.id })
            .from(actions)
            .where(inArray(actions.roundId, targetIds));
          discardedActions = acts.length;
          if (acts.length > 0) {
            await tx
              .delete(actions)
              .where(
                inArray(
                  actions.id,
                  acts.map((a) => a.id),
                ),
              );
          }
          await tx
            .update(rounds)
            .set({ status: 'rolled_back', completedAt: new Date() })
            .where(inArray(rounds.id, targetIds));
        });
      }
    }

    await db.insert(auditLogs).values({
      worldId: scene.worldId,
      worldlineId: scene.worldlineId,
      sceneId: id,
      auditType: 'abort_requested',
      severity: 'warning',
      source: auth.userId,
      description: `User aborted scene; aborted=${aborted.length} discarded_actions=${discardedActions}`,
      actionTaken: parsed.data.discard ? 'rounds_rolled_back' : 'abort_signal_only',
      payload: { discard: parsed.data.discard, aborted, target_rounds: targetRounds.map((r) => r.id) } as Record<
        string,
        unknown
      >,
    });

    publishEvent('round.rolled_back', {
      worldId: scene.worldId,
      worldlineId: scene.worldlineId,
      sceneId: id,
      data: { aborted, discardedActions, discard: parsed.data.discard ?? false },
    });

    return ok({ abortedRoundIds: aborted, discardedActions, targetRoundIds: targetRounds.map((r) => r.id) });
  } catch (e) {
    return serverError('Abort failed', String(e));
  }
}
