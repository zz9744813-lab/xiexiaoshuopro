// mastra/tools/record-fact.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { canonFacts } from '@/db/schema'

export const recordFact = createTool({
  id: 'record-fact',
  description: '记录一条新的 canon fact',
  inputSchema: z.object({
    projectId: z.string(),
    fact: z.string(),
    category: z.string().optional(),
    source: z.string(),
    confidence: z.number().min(0).max(1).default(1),
  }),
  execute: async ({ projectId, fact, category, source, confidence }) => {
    const [entry] = await db.insert(canonFacts).values({
      projectId,
      fact,
      category: category || 'general',
      source,
      confidence,
    }).returning()
    return { id: entry.id, fact: entry.fact }
  },
})
