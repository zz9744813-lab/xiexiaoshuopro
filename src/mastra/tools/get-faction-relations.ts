// src/mastra/tools/get-faction-relations.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { factions } from '@/db/schema'

export const getFactionRelations = createTool({
  id: 'get-faction-relations',
  description: '获取势力关系',
  inputSchema: z.object({
    projectId: z.string(),
    factionId: z.string().optional(),
  }),
  execute: async ({ projectId, factionId }) => {
    const rows = await db.select().from(factions).where(eq(factions.projectId, projectId))
    return rows
  },
})
