// mastra/tools/search-world-by-kw.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { worldEntries } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export const searchWorldByKw = createTool({
  id: 'search-world-by-kw',
  description: '按关键词搜索世界条目',
  inputSchema: z.object({
    projectId: z.string(),
    keyword: z.string(),
    kind: z.enum(['location', 'item', 'concept', 'magic', 'faction', 'rule']).optional(),
    limit: z.number().default(10),
  }),
  execute: async ({ projectId, keyword, kind, limit }) => {
    let entries = await db
      .select()
      .from(worldEntries)
      .where(eq(worldEntries.projectId, projectId))

    if (kind) {
      entries = entries.filter(e => e.kind === kind)
    }

    const lower = keyword.toLowerCase()
    const matched = entries
      .filter(
        e =>
          e.name.toLowerCase().includes(lower) ||
          (e.description && e.description.toLowerCase().includes(lower)) ||
          (e.rules && e.rules.toLowerCase().includes(lower))
      )
      .slice(0, limit)

    return matched.map(e => ({
      id: e.id,
      kind: e.kind,
      name: e.name,
      description: e.description,
      rules: e.rules,
    }))
  },
})
