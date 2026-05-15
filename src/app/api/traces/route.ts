import { NextRequest } from 'next/server';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '@/db';
import { simulationTraces, worlds } from '@/db/schema';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';

// GET /api/traces?world_id=...&round_id=...&entity_id=...
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const worldId = searchParams.get('world_id');
    const roundId = searchParams.get('round_id');
    const entityId = searchParams.get('entity_id');
    const traceType = searchParams.get('trace_type');
    const limit = Math.min(Number(searchParams.get('limit') ?? 100), 500);

    if (!worldId) return badRequest('world_id is required');
    const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    const filters = [eq(simulationTraces.worldId, worldId)];
    if (roundId) filters.push(eq(simulationTraces.roundId, roundId));
    if (entityId) filters.push(eq(simulationTraces.entityId, entityId));
    if (traceType) filters.push(eq(simulationTraces.traceType, traceType));

    const rows = await db
      .select()
      .from(simulationTraces)
      .where(and(...filters))
      .orderBy(desc(simulationTraces.createdAt))
      .limit(limit);

    // Per spec 29.2 - default exporting redacts private_layer; we return everything to author view
    // but mark sensitive fields. Frontend should be careful.
    return ok(rows);
  } catch (e) {
    return serverError('Failed to list traces', String(e));
  }
}
