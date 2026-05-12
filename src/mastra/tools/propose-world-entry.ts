// src/mastra/tools/propose-world-entry.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { worldEntries } from '@/db/schema'

export const proposeWorldEntry = createTool({
  id: 'propose-world-entry',
  description: '提议添加世界条目',
  inputSchema: z.object({
    projectId: z.string(),
    kind: z.enum(['location', 'item', 'concept', 'magic', 'faction', 'rule']),
    name: z.string(),
    description: z.string().optional(),
  }),
  execute: async ({ projectId, kind, name, description }) => {
    const [entry] = await db.insert(worldEntries).values({
      projectId,
      kind,
      name,
      description,
    }).returning()
    return { id: entry.id }
  },
})
