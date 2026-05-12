// src/mastra/tools/zoom-in.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { chapters, chapterVersions } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const zoomIn = createTool({
  id: 'zoom-in',
  description: '按需检索章节原文片段',
  inputSchema: z.object({
    chapterId: z.string(),
    versionId: z.string().optional(),
    offset: z.number().default(0),
    limit: z.number().default(2000),
  }),
  execute: async ({ chapterId, versionId, offset, limit }) => {
    const [chapter] = await db.select({ activeVersionId: chapters.activeVersionId })
      .from(chapters).where(eq(chapters.id, chapterId))
    const vid = versionId || chapter?.activeVersionId
    if (!vid) return { content: '', error: 'no version found' }

    const [version] = await db.select({ contentMd: chapterVersions.contentMd })
      .from(chapterVersions).where(eq(chapterVersions.id, vid))
    if (!version?.contentMd) return { content: '', error: 'empty' }

    const text = version.contentMd.slice(offset, offset + limit)
    return { content: text, total: version.contentMd.length, offset, limit }
  },
})
