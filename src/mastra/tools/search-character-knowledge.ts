// mastra/tools/search-character-knowledge.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { characterKnowledge } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export const searchCharacterKnowledge = createTool({
  id: 'search-character-knowledge',
  description: '搜索角色的知识库',
  inputSchema: z.object({
    characterId: z.string(),
    query: z.string(),
    category: z.enum(['fact', 'suspected', 'lie']).optional(),
    limit: z.number().default(10),
  }),
  execute: async ({ characterId, query, category, limit }) => {
    let knowledge = await db
      .select()
      .from(characterKnowledge)
      .where(eq(characterKnowledge.characterId, characterId))

    if (category) {
      knowledge = knowledge.filter(k => k.category === category)
    }

    const lower = query.toLowerCase()
    const matched = knowledge
      .filter(k => k.content.toLowerCase().includes(lower))
      .sort((a, b) => (b.certainty || 0) - (a.certainty || 0))
      .slice(0, limit)

    return matched.map(k => ({
      id: k.id,
      category: k.category,
      content: k.content,
      certainty: k.certainty,
      sourceEvent: k.sourceEvent,
    }))
  },
})
