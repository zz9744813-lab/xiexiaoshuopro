// mastra/workflows/regeneration-cascade.ts — 级联重生成 Workflow
import { mastra } from '@/mastra'
import { db } from '@/db'
import { chapters } from '@/db/schema'
import { eq, and, gte } from 'drizzle-orm'

export interface RegenerationCascadeInput {
  projectId: string
  volumeId: string
  triggerChapterId: string   // 触发重生成的章节
  triggerReason: string       // 为什么需要重生成
  cascadeFromNumber: number   // 从第几章开始级联
}

export interface RegenerationCascadeResult {
  affectedChapterIds: string[]
  newOutline: Array<{ chapterNumber: number; title: string; synopsis: string }>
  summary: string
}

/**
 * Regeneration Cascade Workflow — 当某个章节发生重大修改时，级联更新后续章节
 * 比如：第 5 章改了关键情节 → 重新生成第 6-10 章的大纲
 */
export async function runRegenerationCascade(
  input: RegenerationCascadeInput
): Promise<RegenerationCascadeResult> {
  // 1. Find all downstream chapters
  const downstream = await db
    .select({ id: chapters.id, chapterNumber: chapters.chapterNumber })
    .from(chapters)
    .where(
      and(
        eq(chapters.volumeId, input.volumeId),
        gte(chapters.chapterNumber, input.cascadeFromNumber)
      )
    )

  const affectedIds = downstream.map(c => c.id)
  const agent = mastra.getAgent('director')

  const prompt = [
    `## 级联重生成请求`,
    `reason: ${input.triggerReason}`,
    `cascade_from: chapter ${input.cascadeFromNumber}`,
    `affected_chapters: ${affectedIds.length} chapters`,
    ``,
    `请为受影响的章节生成新大纲：`,
    `- 每章一个 title 和 synopsis`,
    `- 确保新情节与触发章节的修改一致`,
    `- 保持原卷的整体结构`,
  ].join('\n')

  const result = await agent.generate(prompt)

  try {
    const parsed = JSON.parse(result.text)
    return {
      affectedChapterIds: affectedIds,
      newOutline: parsed.outline || [],
      summary: parsed.summary || '',
    }
  } catch {
    return { affectedChapterIds: affectedIds, newOutline: [], summary: '' }
  }
}
