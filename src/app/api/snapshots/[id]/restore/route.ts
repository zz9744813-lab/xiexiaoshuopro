import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { snapshots, worlds } from '@/db/schema';
import { ok, badRequest, notFound, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';
import { restoreSnapshotToWorldline } from '@/lib/simulation/snapshot';

const schema = z.object({
  /** Required confirmation flag - prevents accidental restore */
  confirmRollback: z.literal(true),
});

/**
 * POST /api/snapshots/[id]/restore
 * Body: { confirmRollback: true }
 *
 * Hard-deletes worldline data created after the snapshot, then upserts
 * memories/relationships from the snapshot blob. Single transaction.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const auth = await getAuthContext();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Must POST { confirmRollback: true }', parsed.error.flatten());
    }

    const [snap] = await db.select().from(snapshots).where(eq(snapshots.id, id));
    if (!snap) return notFound('Snapshot not found');

    const [world] = await db.select().from(worlds).where(eq(worlds.id, snap.worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    const result = await restoreSnapshotToWorldline(id);
    return ok(result);
  } catch (e) {
    return serverError('Restore failed', String(e));
  }
}
