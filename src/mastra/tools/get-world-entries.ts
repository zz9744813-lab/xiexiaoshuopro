// mastra/tools/get-world-entries.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { worldEntries } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export const getWorldEntries = createTool({
  id: 'get-world-entries',
  description: '获取项目的世界条目',
  inputSchema: z.object({
    projectId: z.string(),
    kind: z.enum(['location', 'item', 'concept', 'magic', 'faction', 'rule']).optional(),
    limit: z.number().default(20),
  }),
  execute: async ({ projectId, kind, limit }) => {
    let entries = await db
      .select()
      .from(worldEntries)
      .where(eq(worldEntries.projectId, projectId))

    if (kind) {
      entries = entries.filter(e => e.kind === kind)
    }

    return entries.slice(0, limit).map(e => ({
      id: e.id,
      kind: e.kind,
      name: e.name,
      description: e.description,
      rules: e.rules,
      appearanceCount: e.appearanceCount,
    }))
  },
})
