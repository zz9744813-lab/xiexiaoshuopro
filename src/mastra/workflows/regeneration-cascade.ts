// mastra/workflows/regeneration-cascade.ts
import { mastra } from '@/mastra'
import { db } from '@/db'
import { chapters, chapterOutlines } from '@/db/schema'
import { eq, and, gte, inArray } from 'drizzle-orm'

export interface RegenerationCascadeInput {
  projectId: string
  volumeId: string
  triggerChapterId: string
  triggerReason: string
  cascadeFromNumber: number
}

export interface RegenerationCascadeResult {
  affectedChapterIds: string[]
  newOutline: Array<{ chapterNumber: number; title: string; synopsis: string }>
  summary: string
}

export async function runRegenerationCascade(
  input: RegenerationCascadeInput
): Promise<RegenerationCascadeResult> {
  // 1. 找出该卷内 chapterNum >= cascadeFromNumber 的所有 outlines
  const outlines = await db
    .select({ id: chapterOutlines.id, chapterNum: chapterOutlines.chapterNum })
    .from(chapterOutlines)
    .where(
      and(
        eq(chapterOutlines.volumeId, input.volumeId),
        gte(chapterOutlines.chapterNum, input.cascadeFromNumber)
      )
    )

  if (outlines.length === 0) {
    return { affectedChapterIds: [], newOutline: [], summary: '' }
  }

  const outlineIds = outlines.map(o => o.id)
  const downstreamChapters = await db
    .select({ id: chapters.id })
    .from(chapters)
    .where(inArray(chapters.chapterOutlineId, outlineIds))

  const affectedIds = downstreamChapters.map(r => r.id)

  const agent = mastra.getAgent('director')
  const prompt = [
    `## 级联重生成请求`,
    `reason: ${input.triggerReason}`,
    `cascade_from: chapter ${input.cascadeFromNumber}`,
    `affected_chapters: ${affectedIds.length} chapters`,
    ``,
    `请为受影响的章节生成新大纲。输出 JSON：`,
    `{ "outline": [{"chapterNumber": int, "title": "", "synopsis": ""}], "summary": "" }`,
  ].join('\n')

  const result = await agent.generate({
    messages: [{ role: 'user', content: prompt }],
    runtimeContext: { projectId: input.projectId, volumeId: input.volumeId },
  })

  try {
    const m = result.text.match(/\{[\s\S]*\}/)
    const parsed = m ? JSON.parse(m[0]) : {}
    return {
      affectedChapterIds: affectedIds,
      newOutline: parsed.outline || [],
      summary: parsed.summary || '',
    }
  } catch {
    return { affectedChapterIds: affectedIds, newOutline: [], summary: '' }
  }
}
