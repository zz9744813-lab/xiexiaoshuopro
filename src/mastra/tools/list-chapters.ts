// mastra/tools/list-chapters.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { chapterOutlines } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const listChapters = createTool({
  id: 'list-chapters',
  description: '列出卷的所有章节大纲',
  inputSchema: z.object({
    volumeId: z.string(),
    status: z.string().optional(),
  }),
  execute: async ({ volumeId, status }) => {
    let chaps = await db
      .select({
        id: chapterOutlines.id,
        chapterNum: chapterOutlines.chapterNum,
        title: chapterOutlines.title,
        beatsMd: chapterOutlines.beatsMd,
        targetWordCount: chapterOutlines.targetWordCount,
        povCharacterId: chapterOutlines.povCharacterId,
        status: chapterOutlines.status,
      })
      .from(chapterOutlines)
      .where(eq(chapterOutlines.volumeId, volumeId))
      .orderBy(chapterOutlines.chapterNum)

    if (status) {
      chaps = chaps.filter(c => c.status === status)
    }

    return chaps
  },
})
