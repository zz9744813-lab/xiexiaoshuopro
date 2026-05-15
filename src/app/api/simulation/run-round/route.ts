import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { scenes, entities, worlds } from '@/db/schema';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';
import { runRoundSimultaneous } from '@/lib/simulation/engine';

const runRoundSchema = z.object({
  sceneId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const body = await req.json();
    const parsed = runRoundSchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten());

    const [scene] = await db.select().from(scenes).where(eq(scenes.id, parsed.data.sceneId));
    if (!scene) return badRequest('Scene not found');

    const [world] = await db.select().from(worlds).where(eq(worlds.id, scene.worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    // Find the world_agent entity
    const allEntities = await db
      .select()
      .from(entities)
      .where(eq(entities.worldId, scene.worldId));
    const worldAgent = allEntities.find((e) => e.entityType === 'world_agent');
    if (!worldAgent) return badRequest('No world_agent found in this world');

    const result = await runRoundSimultaneous({
      worldId: scene.worldId,
      worldlineId: scene.worldlineId,
      sceneId: scene.id,
      participantEntityIds: scene.participantEntityIds ?? [],
      worldAgentEntityId: worldAgent.id,
    });

    return ok(result);
  } catch (e) {
    return serverError('Failed to run round', String(e));
  }
}
