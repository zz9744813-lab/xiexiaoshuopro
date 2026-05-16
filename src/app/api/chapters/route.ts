import { NextRequest } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/db';
import { novelChapters, worlds } from '@/db/schema';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';

// GET /api/chapters?world_id=...&worldline_id=...
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
        id: novelChapters.id,
        chapterIndex: novelChapters.chapterIndex,
        title: novelChapters.title,
        worldlineId: novelChapters.worldlineId,
        faithfulnessScore: novelChapters.faithfulnessScore,
        changedMajorFacts: novelChapters.changedMajorFacts,
        status: novelChapters.status,
        createdAt: novelChapters.createdAt,
      })
      .from(novelChapters)
      .where(eq(novelChapters.worldId, worldId))
      .orderBy(desc(novelChapters.createdAt));

    const filtered = worldlineId ? rows.filter((r) => r.worldlineId === worldlineId) : rows;
    return ok(filtered);
  } catch (e) {
    return serverError('Failed', String(e));
  }
}
