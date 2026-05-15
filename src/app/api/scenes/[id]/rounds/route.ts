import { NextRequest } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/db';
import { rounds, actions, scenes, worlds } from '@/db/schema';
import { ok, badRequest, notFound, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';

// GET /api/scenes/[id]/rounds - returns rounds + actions for the scene
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const auth = await getAuthContext();

    const [scene] = await db.select().from(scenes).where(eq(scenes.id, id));
    if (!scene) return notFound('Scene not found');

    const [world] = await db.select().from(worlds).where(eq(worlds.id, scene.worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    const rs = await db
      .select()
      .from(rounds)
      .where(eq(rounds.sceneId, id))
      .orderBy(asc(rounds.roundIndex));

    // Fetch all actions in scene
    const acts = await db
      .select()
      .from(actions)
      .where(eq(actions.sceneId, id))
      .orderBy(asc(actions.createdAt));

    return ok({ rounds: rs, actions: acts });
  } catch (e) {
    return serverError('Failed to load scene rounds', String(e));
  }
}
