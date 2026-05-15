import { NextRequest } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/db';
import { scenes, worlds } from '@/db/schema';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';

// GET /api/scenes/list?world_id=...
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const worldId = searchParams.get('world_id');
    if (!worldId) return badRequest('world_id is required');

    const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    const rows = await db
      .select()
      .from(scenes)
      .where(eq(scenes.worldId, worldId))
      .orderBy(desc(scenes.createdAt));
    return ok(rows);
  } catch (e) {
    return serverError('Failed to list scenes', String(e));
  }
}
