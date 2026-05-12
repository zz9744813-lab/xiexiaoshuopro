// mastra/tools/list-volumes.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { volumes } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export const listVolumes = createTool({
  id: 'list-volumes',
  description: '列出项目的所有卷',
  inputSchema: z.object({
    projectId: z.string(),
    status: z.enum(['planning', 'drafting', 'revising', 'finalized']).optional(),
  }),
  execute: async ({ projectId, status }) => {
    let vols = await db
      .select({
        id: volumes.id,
        volumeNum: volumes.volumeNum,
        title: volumes.title,
        thesis: volumes.thesis,
        readerPromise: volumes.readerPromise,
        status: volumes.status,
        finalizedAt: volumes.finalizedAt,
      })
      .from(volumes)
      .where(eq(volumes.projectId, projectId))
      .orderBy(volumes.volumeNum)

    if (status) {
      vols = vols.filter(v => v.status === status)
    }

    return vols
  },
})
