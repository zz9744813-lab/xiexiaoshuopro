import { NextRequest } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { memoryWriteRequests, memories, worlds } from '@/db/schema';
import { ok, badRequest, notFound, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';

// GET /api/memory-requests?world_id=...&status=pending
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const worldId = searchParams.get('world_id');
    const status = searchParams.get('status') ?? 'pending';
    if (!worldId) return badRequest('world_id is required');

    const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    const rows = await db
      .select()
      .from(memoryWriteRequests)
      .where(
        and(
          eq(memoryWriteRequests.worldId, worldId),
          eq(memoryWriteRequests.status, status),
        ),
      )
      .orderBy(desc(memoryWriteRequests.createdAt));
    return ok(rows);
  } catch (e) {
    return serverError('Failed to list', String(e));
  }
}

const decisionSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(['approve', 'reject']),
});

// POST /api/memory-requests/decide
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const body = await req.json();
    const parsed = decisionSchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten());

    const [mwr] = await db
      .select()
      .from(memoryWriteRequests)
      .where(eq(memoryWriteRequests.id, parsed.data.id));
    if (!mwr) return notFound('Request not found');

    const [world] = await db.select().from(worlds).where(eq(worlds.id, mwr.worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    if (mwr.status !== 'pending') {
      return badRequest('Request already processed');
    }

    if (parsed.data.decision === 'reject') {
      await db
        .update(memoryWriteRequests)
        .set({
          status: 'rejected',
          reviewedByUserId: auth.userId,
          reviewedAt: new Date(),
        })
        .where(eq(memoryWriteRequests.id, parsed.data.id));
      return ok({ status: 'rejected' });
    }

    // Approve - insert into memories
    const payload = mwr.proposedPayload as Record<string, unknown>;
    const result = await db.transaction(async (tx) => {
      const [mem] = await tx
        .insert(memories)
        .values({
          worldId: mwr.worldId,
          worldlineId: mwr.worldlineId,
          ownerEntityId: String(payload.owner_entity_id),
          memoryType: String(payload.memory_type ?? 'episodic'),
          content: String(payload.content ?? ''),
          visibility: String(payload.visibility ?? 'private'),
          importance: String(payload.importance ?? 0.5),
          emotionalWeight: String(payload.emotional_weight ?? 0),
          proposedBy: mwr.proposedBy,
          approvalStatus: 'approved',
          approvalUserId: auth.userId,
          approvalAt: new Date(),
        })
        .returning({ id: memories.id });

      await tx
        .update(memoryWriteRequests)
        .set({
          status: 'applied',
          reviewedByUserId: auth.userId,
          reviewedAt: new Date(),
          appliedMemoryId: mem.id,
        })
        .where(eq(memoryWriteRequests.id, parsed.data.id));

      return { memoryId: mem.id };
    });

    return ok({ status: 'approved', ...result });
  } catch (e) {
    return serverError('Failed', String(e));
  }
}
