/**
 * Memory write helpers - create memories with embedding auto-generated.
 */
import { sql, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { memories } from '@/db/schema';
import { embedTexts } from './embedding-service';

export interface MemoryInsert {
  worldId: string;
  worldlineId: string;
  ownerEntityId: string;
  memoryType: string;
  content: string;
  summary?: string;
  visibility: string;
  allowedEntities?: string[];
  deniedEntities?: string[];
  truthStatus?: string;
  confidence?: number;
  importance?: number;
  emotionalWeight?: number;
  proposedBy?: string;
  approvalStatus?: string;
  sourceEventId?: string;
  sourceActionId?: string;
  tags?: string[];
}

/** Insert a memory and auto-generate embedding (best-effort, async). */
export async function insertMemoryWithEmbedding(input: MemoryInsert): Promise<string> {
  const [row] = await db
    .insert(memories)
    .values({
      worldId: input.worldId,
      worldlineId: input.worldlineId,
      ownerEntityId: input.ownerEntityId,
      memoryType: input.memoryType,
      content: input.content,
      summary: input.summary,
      visibility: input.visibility,
      allowedEntities: input.allowedEntities ?? [],
      deniedEntities: input.deniedEntities ?? [],
      truthStatus: input.truthStatus ?? 'subjective',
      confidence: (input.confidence ?? 1).toString(),
      importance: (input.importance ?? 0.5).toString(),
      emotionalWeight: (input.emotionalWeight ?? 0).toString(),
      proposedBy: input.proposedBy ?? 'character_self',
      approvalStatus: input.approvalStatus ?? 'auto_approved',
      sourceEventId: input.sourceEventId,
      sourceActionId: input.sourceActionId,
      tags: input.tags ?? [],
    })
    .returning({ id: memories.id });

  // Generate embedding asynchronously - failure to embed should not block memory
  void embedAndUpdate(row.id, input.worldId, input.content).catch(() => {
    // ignore - memory is still readable, just won't be in semantic search
  });

  return row.id;
}

async function embedAndUpdate(
  memoryId: string,
  worldId: string,
  content: string,
): Promise<void> {
  try {
    const r = await embedTexts({ texts: [content], worldId });
    if (r.embeddings[0]) {
      const vec = sql`${`[${r.embeddings[0].join(',')}]`}::vector`;
      await db
        .update(memories)
        .set({ embedding: sql`${vec}` })
        .where(eq(memories.id, memoryId));
    }
  } catch {
    // skip
  }
}

/** Re-embed a batch of memories (e.g., after switching embedding model). */
export async function reembedMemoryBatch(
  worldId: string,
  memoryIds: string[],
): Promise<{ ok: number; failed: number }> {
  const rows = await db
    .select({ id: memories.id, content: memories.content })
    .from(memories)
    .where(inArray(memories.id, memoryIds));

  const r = await embedTexts({
    texts: rows.map((x) => x.content),
    worldId,
  });

  let okCount = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i++) {
    const emb = r.embeddings[i];
    if (!emb) {
      failed++;
      continue;
    }
    try {
      const vec = sql`${`[${emb.join(',')}]`}::vector`;
      await db
        .update(memories)
        .set({ embedding: sql`${vec}` })
        .where(eq(memories.id, rows[i].id));
      okCount++;
    } catch {
      failed++;
    }
  }

  return { ok: okCount, failed };
}
