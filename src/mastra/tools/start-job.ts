// mastra/tools/start-job.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { jobs } from '@/db/schema'

export const startJob = createTool({
  id: 'start-job',
  description: '开始一个可观测的 job',
  inputSchema: z.object({
    projectId: z.string(),
    type: z.string(),
    context: z.record(z.unknown()).optional(),
  }),
  execute: async ({ projectId, type, context }) => {
    const [job] = await db.insert(jobs).values({
      projectId,
      type,
      context: context || {},
      status: 'running',
      startedAt: new Date(),
    }).returning()
    return { jobId: job.id, type: job.type }
  },
})
