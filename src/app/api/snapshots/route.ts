import { NextRequest } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { snapshots, worlds } from '@/db/schema';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';
import { createSnapshot } from '@/lib/simulation/snapshot';

const createSchema = z.object({
  worldId: z.string().uuid(),
  worldlineId: z.string().uuid(),
  snapshotType: z.enum(['scene_start', 'scene_end', 'worldline_fork', 'user_checkpoint']),
  sceneId: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const worldId = searchParams.get('world_id');
    const worldlineId = searchParams.get('worldline_id');
    if (!worldId) return badRequest('world_id is required');
    const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    const rows = await db
      .select({
        id: snapshots.id,
        worldId: snapshots.worldId,
        worldlineId: snapshots.worldlineId,
        snapshotType: snapshots.snapshotType,
        sceneId: snapshots.sceneId,
        sizeBytes: snapshots.sizeBytes,
        stateHash: snapshots.stateHash,
        createdAt: snapshots.createdAt,
      })
      .from(snapshots)
      .where(eq(snapshots.worldId, worldId))
      .orderBy(desc(snapshots.createdAt));

    const filtered = worldlineId ? rows.filter((r) => r.worldlineId === worldlineId) : rows;
    return ok(filtered);
  } catch (e) {
    return serverError('Failed', String(e));
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten());

    const [world] = await db.select().from(worlds).where(eq(worlds.id, parsed.data.worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    const result = await createSnapshot(parsed.data);
    return ok(result, 201);
  } catch (e) {
    return serverError('Failed', String(e));
  }
}
