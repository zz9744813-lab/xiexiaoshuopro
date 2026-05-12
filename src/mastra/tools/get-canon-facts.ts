// mastra/tools/get-canon-facts.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { canonFacts } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export const getCanonFacts = createTool({
  id: 'get-canon-facts',
  description: '获取项目的硬性事实列表',
  inputSchema: z.object({
    projectId: z.string(),
    category: z.string().optional(),
    limit: z.number().default(20),
  }),
  execute: async ({ projectId, category, limit }) => {
    let facts = await db
      .select()
      .from(canonFacts)
      .where(eq(canonFacts.projectId, projectId))

    if (category) {
      facts = facts.filter(f => f.category === category)
    }

    return facts.slice(0, limit).map(f => ({
      id: f.id,
      fact: f.fact,
      category: f.category,
      immutable: f.immutable,
    }))
  },
})
