// mastra/tools/get-recent-summaries.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { chapterSummaries, chapters, chapterOutlines } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const getRecentSummaries = createTool({
  id: 'get-recent-summaries',
  description: '获取最近 N 章的摘要',
  inputSchema: z.object({
    currentChapterNum: z.number(),
    volumeId: z.string(),
    count: z.number().default(3),
  }),
  execute: async ({ currentChapterNum, volumeId, count }) => {
    const outlines = await db
      .select()
      .from(chapterOutlines)
      .where(eq(chapterOutlines.volumeId, volumeId))

    const previousOutlines = outlines
      .filter(o => o.chapterNum < currentChapterNum)
      .sort((a, b) => b.chapterNum - a.chapterNum)
      .slice(0, count)

    const results = []
    for (const outline of previousOutlines) {
      const [chapter] = await db
        .select()
        .from(chapters)
        .where(eq(chapters.chapterOutlineId, outline.id))

      let summary = null
      if (chapter) {
        const [s] = await db
          .select()
          .from(chapterSummaries)
          .where(eq(chapterSummaries.chapterId, chapter.id))
        summary = s
      }

      results.push({
        chapterNum: outline.chapterNum,
        title: outline.title,
        shortSummary: summary?.shortSummary || null,
      })
    }

    return results
  },
})
