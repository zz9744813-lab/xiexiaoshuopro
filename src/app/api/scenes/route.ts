import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { scenes, worlds } from '@/db/schema';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';

const createSceneSchema = z.object({
  worldId: z.string().uuid(),
  worldlineId: z.string().uuid(),
  title: z.string().max(200).optional(),
  locationId: z.string().uuid().optional(),
  worldTime: z.record(z.string(), z.unknown()).optional(),
  participantEntityIds: z.array(z.string().uuid()).max(50),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const body = await req.json();
    const parsed = createSceneSchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten());

    const [world] = await db.select().from(worlds).where(eq(worlds.id, parsed.data.worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    const [row] = await db
      .insert(scenes)
      .values({
        worldId: parsed.data.worldId,
        worldlineId: parsed.data.worldlineId,
        title: parsed.data.title,
        locationId: parsed.data.locationId,
        worldTime: parsed.data.worldTime ?? {
          world_day: 1,
          time_block: 'evening',
        },
        participantEntityIds: parsed.data.participantEntityIds,
        status: 'pending',
      })
      .returning();

    return ok(row, 201);
  } catch (e) {
    return serverError('Failed to create scene', String(e));
  }
}
