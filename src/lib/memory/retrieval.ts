/**
 * Semantic memory retrieval using pgvector + ACL filter.
 *
 * SECURITY: ACL must be applied AFTER vector search (or via SQL where clause).
 * Never return memories the target cannot read.
 */
import { sql, eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { memories, entities } from '@/db/schema';
import { canRead, type AclInfo, type AclTarget, type AclContext } from '@/lib/context-router/acl';
import { embedText } from './embedding-service';
import { computeDecayLevel, scoreMemory } from './decay';

export interface RetrievalQuery {
  worldId: string;
  worldlineId: string;
  /** The entity for which we are retrieving (ACL target) */
  targetEntityId: string;
  query: string;
  limit?: number;
  /** Current world day for recency scoring */
  currentWorldDay?: number;
  /** Goal-related keywords for relevance bonus (optional) */
  goalKeywords?: string[];
}

export interface RetrievedMemory {
  id: string;
  ownerEntityId: string;
  content: string;
  memoryType: string;
  visibility: string;
  importance: number;
  emotionalWeight: number;
  decayLevel: number;
  truthStatus: string;
  similarity: number;
  score: number;
}

/**
 * Per spec 14.1 + 13.x.
 * Stage 1: pgvector top-K candidates from worldline (ACL-permissive at SQL level)
 * Stage 2: in-memory ACL filter + scoring
 */
export async function retrieveMemories(q: RetrievalQuery): Promise<RetrievedMemory[]> {
  const limit = q.limit ?? 30;

  // Step 1: embed query
  const queryEmbedding = await embedText(q.query, q.worldId);

  // Step 2: vector search (cosine distance) - load up to 3x limit then filter
  // Drizzle has cosineDistance helper; using raw sql for portability
  const queryVec = sql`${`[${queryEmbedding.join(',')}]`}::vector`;
  const candidates = await db
    .select({
      id: memories.id,
      ownerEntityId: memories.ownerEntityId,
      content: memories.content,
      memoryType: memories.memoryType,
      visibility: memories.visibility,
      allowedEntities: memories.allowedEntities,
      deniedEntities: memories.deniedEntities,
      allowedFactions: memories.allowedFactions,
      importance: memories.importance,
      emotionalWeight: memories.emotionalWeight,
      decayLevel: memories.decayLevel,
      truthStatus: memories.truthStatus,
      reinforcementCount: memories.reinforcementCount,
      // distance: cosine
      similarity: sql<number>`1 - (${memories.embedding} <=> ${queryVec})`,
    })
    .from(memories)
    .where(
      and(
        eq(memories.worldId, q.worldId),
        eq(memories.worldlineId, q.worldlineId),
        eq(memories.approvalStatus, 'auto_approved'),
        isNull(memories.archivedAt),
      ),
    )
    .orderBy(sql`${memories.embedding} <=> ${queryVec}`)
    .limit(limit * 3);

  // Step 3: load target entity for ACL
  const [target] = await db.select().from(entities).where(eq(entities.id, q.targetEntityId));
  if (!target) return [];
  const aclTarget: AclTarget = {
    entityId: target.id,
    entityType: target.entityType as AclTarget['entityType'],
  };
  const aclCtx: AclContext = { isAuthorView: false };

  // Step 4: ACL filter + score
  const out: RetrievedMemory[] = [];
  for (const c of candidates) {
    const info: AclInfo = {
      owner_entity_id: c.ownerEntityId,
      visibility: c.visibility as AclInfo['visibility'],
      allowed_entities: c.allowedEntities ?? [],
      denied_entities: c.deniedEntities ?? [],
      allowed_factions: c.allowedFactions ?? [],
    };
    if (!canRead(info, aclTarget, aclCtx)) continue;

    const importance = Number(c.importance);
    const emotionalWeight = Number(c.emotionalWeight);
    const decayLevel = Number(c.decayLevel);
    const similarity = Math.max(0, Math.min(1, Number(c.similarity)));

    const score = scoreMemory({
      semanticSimilarity: similarity,
      importance,
      emotionalWeight,
      recencyScore: 0.5, // TODO: compute from valid_from_world_time
      goalRelevance: q.goalKeywords?.some((k) => c.content.includes(k)) ? 0.6 : 0.1,
      relationshipRelevance: 0.1,
      decayLevel,
      truthStatus: c.truthStatus,
    });

    out.push({
      id: c.id,
      ownerEntityId: c.ownerEntityId,
      content: c.content,
      memoryType: c.memoryType,
      visibility: c.visibility,
      importance,
      emotionalWeight,
      decayLevel,
      truthStatus: c.truthStatus,
      similarity,
      score,
    });
  }

  // Step 5: sort by score, limit
  out.sort((a, b) => b.score - a.score);

  // Step 6: reinforcement_count++ for retrieved memories (spec 14.4)
  // Best-effort fire-and-forget; not in transaction
  const retrievedIds = out.slice(0, limit).map((m) => m.id);
  if (retrievedIds.length > 0) {
    db.update(memories)
      .set({
        reinforcementCount: sql`${memories.reinforcementCount} + 1`,
        lastAccessedAt: new Date(),
      })
      .where(sql`${memories.id} = ANY(${retrievedIds})`)
      .catch(() => {
        // ignore
      });
  }

  // Suppress unused
  void computeDecayLevel;

  return out.slice(0, limit);
}
