// src/mastra/tools/get-open-plot-threads.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { foreshadowings } from '@/db/schema'
import { and, eq, notInArray } from 'drizzle-orm'

export const getOpenPlotThreads = createTool({
  id: 'get-open-plot-threads',
  description: '拿项目所有尚未回收 / 放弃的伏笔',
  inputSchema: z.object({
    projectId: z.string(),
    minImportance: z.number().default(1),
  }),
  execute: async ({ projectId, minImportance }) => {
    const rows = await db.select().from(foreshadowings)
      .where(and(
        eq(foreshadowings.projectId, projectId),
        notInArray(foreshadowings.status, ['paid_off', 'abandoned']),
      ))
    return rows
      .filter(r => (r.importance ?? 5) >= minImportance)
      .map(r => ({
        id: r.id,
        title: r.title,
        kind: r.kind,
        status: r.status,
        importance: r.importance,
        introducedChapterId: r.introducedChapterId,
        expectedPayoffRange: r.expectedPayoffRange,
      }))
  },
})
