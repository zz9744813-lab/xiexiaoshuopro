/**
 * Memory summarization & archival per spec 14.5.
 *
 * Flow:
 * 1. Pick low-importance + low-recency + same-topic batch
 * 2. Use a memory_summarizer prompt to produce a summary memory
 * 3. Mark originals as archived_at
 * 4. Insert summary memory with same owner/visibility
 */
import { eq, and, isNull, asc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { memories } from '@/db/schema';
import { insertMemoryWithEmbedding } from './writer';
import { callLLM } from '@/lib/simulation/llm-service';

export interface SummarizeJobInput {
  worldId: string;
  worldlineId: string;
  ownerEntityId: string;
  /** Trigger threshold: when active memories >= max */
  maxActive?: number;
  /** How many oldest low-importance memories to bundle into a summary */
  batchSize?: number;
  /** API profile for the summarizer */
  apiProfileId: string;
}

export interface SummarizeJobResult {
  archivedCount: number;
  summaryMemoryId?: string;
  skipped?: string;
}

const SUMMARIZER_SYSTEM = `你是记忆摘要器。
你的输入是某个角色的若干条旧记忆。请把它们浓缩成一段简短叙述（不超过 800 字），保留：
- 关键人物
- 关键地点
- 关键时间
- 关键事件因果
不要添加任何原文中没有的事实。
不要做文学加工。
只输出一段中文摘要文字（不要 JSON）。
`;

export async function runSummarizeJob(input: SummarizeJobInput): Promise<SummarizeJobResult> {
  const maxActive = input.maxActive ?? 3000;
  const batchSize = input.batchSize ?? 100;

  // Count active memories for owner
  const [{ cnt }] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(memories)
    .where(
      and(
        eq(memories.worldId, input.worldId),
        eq(memories.worldlineId, input.worldlineId),
        eq(memories.ownerEntityId, input.ownerEntityId),
        isNull(memories.archivedAt),
      ),
    );

  if (cnt < maxActive) {
    return { archivedCount: 0, skipped: `active=${cnt} < threshold ${maxActive}` };
  }

  // Pick oldest low-importance batch
  const batch = await db
    .select({
      id: memories.id,
      content: memories.content,
      importance: memories.importance,
      visibility: memories.visibility,
      memoryType: memories.memoryType,
      confidence: memories.confidence,
    })
    .from(memories)
    .where(
      and(
        eq(memories.worldId, input.worldId),
        eq(memories.worldlineId, input.worldlineId),
        eq(memories.ownerEntityId, input.ownerEntityId),
        isNull(memories.archivedAt),
        sql`${memories.importance} < 0.5`,
        eq(memories.memoryType, 'episodic'),
      ),
    )
    .orderBy(asc(memories.createdAt))
    .limit(batchSize);

  if (batch.length === 0) {
    return { archivedCount: 0, skipped: 'no candidates to summarize' };
  }

  // Determine summary visibility = most-restrictive among batch (conservative)
  const visibilities = new Set(batch.map((b) => b.visibility));
  const summaryVisibility = visibilities.has('private')
    ? 'private'
    : visibilities.has('shared')
      ? 'shared'
      : 'public';

  // Lowest confidence
  const minConfidence = Math.min(...batch.map((b) => Number(b.confidence)));

  const userMsg = `请摘要以下 ${batch.length} 条记忆：\n\n${batch
    .map((b, i) => `[${i + 1}] ${b.content}`)
    .join('\n')}`;

  const llm = await callLLM(
    [
      { role: 'system', content: SUMMARIZER_SYSTEM },
      { role: 'user', content: userMsg },
    ],
    {
      apiProfileId: input.apiProfileId,
      worldId: input.worldId,
      worldlineId: input.worldlineId,
      entityId: input.ownerEntityId,
      traceType: 'memory_retrieval', // closest existing trace_type
    },
  );

  const summaryText = llm.response.rawText.trim();
  if (!summaryText) {
    return { archivedCount: 0, skipped: 'empty summary from LLM' };
  }

  const summaryId = await insertMemoryWithEmbedding({
    worldId: input.worldId,
    worldlineId: input.worldlineId,
    ownerEntityId: input.ownerEntityId,
    memoryType: 'summary',
    content: summaryText,
    visibility: summaryVisibility,
    importance: 0.4,
    confidence: minConfidence,
    proposedBy: 'system_note',
    approvalStatus: 'auto_approved',
  });

  // Archive originals
  await db
    .update(memories)
    .set({ archivedAt: new Date(), sourceMemoryId: summaryId })
    .where(sql`${memories.id} = ANY(${batch.map((b) => b.id)})`);

  return { archivedCount: batch.length, summaryMemoryId: summaryId };
}
