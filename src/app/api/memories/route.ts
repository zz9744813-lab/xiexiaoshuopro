import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { memories, entities, worlds } from '@/db/schema';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';
import {
  STR,
  MEMORY_TYPE_ENUM,
  VISIBILITY_ENUM,
  TRUTH_STATUS_ENUM,
  PROPOSED_BY_ENUM,
  confidenceSchema,
  importanceSchema,
  emotionalWeightSchema,
  tagsSchema,
  allowedEntitiesSchema,
} from '@/lib/validation/schemas';

const createMemorySchema = z.object({
  worldId: z.string().uuid(),
  worldlineId: z.string().uuid(),
  ownerEntityId: z.string().uuid(),
  memoryType: MEMORY_TYPE_ENUM,
  content: STR.memoryContent,
  summary: STR.memorySummary,
  visibility: VISIBILITY_ENUM,
  allowedEntities: allowedEntitiesSchema.optional(),
  deniedEntities: allowedEntitiesSchema.optional(),
  truthStatus: TRUTH_STATUS_ENUM.optional(),
  confidence: confidenceSchema.optional(),
  importance: importanceSchema.optional(),
  emotionalWeight: emotionalWeightSchema.optional(),
  proposedBy: PROPOSED_BY_ENUM.optional(),
  tags: tagsSchema.optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const worldId = searchParams.get('world_id');
    const ownerEntityId = searchParams.get('owner_entity_id');
    if (!worldId) return badRequest('world_id is required');

    const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    const filters = [eq(memories.worldId, worldId)];
    if (ownerEntityId) filters.push(eq(memories.ownerEntityId, ownerEntityId));

    const rows = await db
      .select()
      .from(memories)
      .where(and(...filters));
    return ok(rows);
  } catch (e) {
    return serverError('Failed to list memories', String(e));
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const body = await req.json();
    const parsed = createMemorySchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten());

    const [world] = await db.select().from(worlds).where(eq(worlds.id, parsed.data.worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    const [owner] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, parsed.data.ownerEntityId));
    if (!owner || owner.worldId !== parsed.data.worldId) {
      return badRequest('Invalid owner_entity_id');
    }

    // Per spec 12.4: novelizer-proposed must NOT auto-insert; require approval.
    const proposedBy = parsed.data.proposedBy ?? 'user_manual';
    if (proposedBy === 'novelizer') {
      return badRequest(
        'novelizer-proposed memories must go through memory_write_requests, not direct insert',
      );
    }

    const [row] = await db
      .insert(memories)
      .values({
        worldId: parsed.data.worldId,
        worldlineId: parsed.data.worldlineId,
        ownerEntityId: parsed.data.ownerEntityId,
        memoryType: parsed.data.memoryType,
        content: parsed.data.content,
        summary: parsed.data.summary,
        visibility: parsed.data.visibility,
        allowedEntities: parsed.data.allowedEntities ?? [],
        deniedEntities: parsed.data.deniedEntities ?? [],
        truthStatus: parsed.data.truthStatus ?? 'subjective',
        confidence: (parsed.data.confidence ?? 1).toString(),
        importance: (parsed.data.importance ?? 0.5).toString(),
        emotionalWeight: (parsed.data.emotionalWeight ?? 0).toString(),
        proposedBy,
        approvalStatus: 'auto_approved',
        tags: parsed.data.tags ?? [],
      })
      .returning();

    return ok(row, 201);
  } catch (e) {
    return serverError('Failed to create memory', String(e));
  }
}
