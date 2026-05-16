import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { scenes, worlds } from '@/db/schema';
import { ok, badRequest, notFound, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';
import { detectStagnation } from '@/lib/simulation/stagnation-detector';

const schema = z.object({ sceneId: z.string().uuid() });

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten());

    const [scene] = await db.select().from(scenes).where(eq(scenes.id, parsed.data.sceneId));
    if (!scene) return notFound('Scene not found');
    const [world] = await db.select().from(worlds).where(eq(worlds.id, scene.worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    const result = await detectStagnation(parsed.data.sceneId);
    return ok(result);
  } catch (e) {
    return serverError('Failed', String(e));
  }
}
