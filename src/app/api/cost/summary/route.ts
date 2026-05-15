import { NextRequest } from 'next/server';
import { eq, and, gte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { costLogs, worlds } from '@/db/schema';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';

// GET /api/cost/summary?world_id=...&scene_id=...&round_id=...
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const worldId = searchParams.get('world_id');
    const sceneId = searchParams.get('scene_id');
    const roundId = searchParams.get('round_id');

    if (!worldId) return badRequest('world_id is required');
    const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    // Today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayRow = await db
      .select({
        cost: sql<string>`coalesce(sum(${costLogs.costUsd}), 0)`,
        tokenIn: sql<string>`coalesce(sum(${costLogs.tokenInput}), 0)`,
        tokenOut: sql<string>`coalesce(sum(${costLogs.tokenOutput}), 0)`,
      })
      .from(costLogs)
      .where(and(eq(costLogs.worldId, worldId), gte(costLogs.createdAt, startOfDay)));

    let scene = null;
    if (sceneId) {
      const r = await db
        .select({ cost: sql<string>`coalesce(sum(${costLogs.costUsd}), 0)` })
        .from(costLogs)
        .where(eq(costLogs.sceneId, sceneId));
      scene = { cost: Number(r[0]?.cost ?? 0) };
    }

    let round = null;
    if (roundId) {
      const r = await db
        .select({ cost: sql<string>`coalesce(sum(${costLogs.costUsd}), 0)` })
        .from(costLogs)
        .where(eq(costLogs.roundId, roundId));
      round = { cost: Number(r[0]?.cost ?? 0) };
    }

    return ok({
      today: {
        cost: Number(todayRow[0]?.cost ?? 0),
        tokenInput: Number(todayRow[0]?.tokenIn ?? 0),
        tokenOutput: Number(todayRow[0]?.tokenOut ?? 0),
      },
      scene,
      round,
    });
  } catch (e) {
    return serverError('Failed to get cost summary', String(e));
  }
}
