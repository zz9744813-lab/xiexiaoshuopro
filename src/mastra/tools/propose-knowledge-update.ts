// src/mastra/tools/propose-knowledge-update.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { characterKnowledge } from '@/db/schema'

export const proposeKnowledgeUpdate = createTool({
  id: 'propose-knowledge-update',
  description: '提议更新角色知识',
  inputSchema: z.object({
    characterId: z.string(),
    category: z.enum(['fact', 'suspected', 'lie']),
    content: z.string(),
    certainty: z.number().min(0).max(100),
    sourceEvent: z.string(),
  }),
  execute: async ({ characterId, category, content, certainty, sourceEvent }) => {
    const [entry] = await db.insert(characterKnowledge).values({
      characterId,
      category,
      content,
      certainty,
      sourceEvent,
    }).returning()
    return { id: entry.id }
  },
})
