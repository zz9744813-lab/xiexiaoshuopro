import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { simulationTraces, worlds } from '@/db/schema';
import { ok, badRequest, notFound, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';

// GET /api/traces/[id] - single trace detail
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const auth = await getAuthContext();

    const [trace] = await db.select().from(simulationTraces).where(eq(simulationTraces.id, id));
    if (!trace) return notFound('Trace not found');

    const [world] = await db.select().from(worlds).where(eq(worlds.id, trace.worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    return ok(trace);
  } catch (e) {
    return serverError('Failed to load trace', String(e));
  }
}
