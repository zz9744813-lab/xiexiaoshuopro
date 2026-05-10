// mastra/tools/get-world-facts.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { canonFacts, worldEntries } from '@/db/schema'
import { eq, ilike } from 'drizzle-orm'

export const getWorldFacts = createTool({
  id: 'get-world-facts',
  description: '获取世界观设定和硬性事实',
  inputSchema: z.object({
    projectId: z.string(),
    query: z.string().optional().describe('搜索关键词'),
    category: z.string().optional(),
    kind: z.string().optional().describe('世界条目类型：location|item|concept|magic|faction|rule'),
    limit: z.number().default(10),
  }),
  execute: async ({ projectId, query, category, kind, limit }) => {
    // 获取硬性事实
    let facts = await db
      .select()
      .from(canonFacts)
      .where(eq(canonFacts.projectId, projectId))

    if (category) {
      facts = facts.filter(f => f.category === category)
    }

    if (query) {
      const lowerQuery = query.toLowerCase()
      facts = facts.filter(f => f.fact.toLowerCase().includes(lowerQuery))
    }

    // 获取世界条目
    let entries = await db
      .select()
      .from(worldEntries)
      .where(eq(worldEntries.projectId, projectId))

    if (kind) {
      entries = entries.filter(e => e.kind === kind)
    }

    if (query) {
      const lowerQuery = query.toLowerCase()
      entries = entries.filter(
        e =>
          e.name.toLowerCase().includes(lowerQuery) ||
          (e.description && e.description.toLowerCase().includes(lowerQuery)) ||
          (e.rules && e.rules.toLowerCase().includes(lowerQuery))
      )
    }

    return {
      facts: facts.slice(0, limit).map(f => ({
        id: f.id,
        fact: f.fact,
        category: f.category,
        immutable: f.immutable,
      })),
      worldEntries: entries.slice(0, limit).map(e => ({
        id: e.id,
        kind: e.kind,
        name: e.name,
        description: e.description,
        rules: e.rules,
      })),
    }
  },
})
