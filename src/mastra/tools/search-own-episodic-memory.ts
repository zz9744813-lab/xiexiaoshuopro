// mastra/tools/search-own-episodic-memory.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { characterEpisodicMemory } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export const searchOwnEpisodicMemory = createTool({
  id: 'search-own-episodic-memory',
  description: '搜索角色的情节记忆（尝试语义搜索，回退到文本匹配）',
  inputSchema: z.object({
    characterId: z.string(),
    query: z.string(),
    episodeType: z.enum(['conversation', 'action', 'witnessed', 'learned', 'felt']).optional(),
    limit: z.number().default(10),
  }),
  execute: async ({ characterId, query, episodeType, limit }) => {
    let memories = await db
      .select()
      .from(characterEpisodicMemory)
      .where(eq(characterEpisodicMemory.characterId, characterId))

    if (episodeType) {
      memories = memories.filter(m => m.episodeType === episodeType)
    }

    // Fallback text search
    const lower = query.toLowerCase()
    const matched = memories
      .filter(m => m.summary.toLowerCase().includes(lower))
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, limit)

    return matched.map(m => ({
      id: m.id,
      episodeType: m.episodeType,
      summary: m.summary,
      emotionalValence: m.emotionalValence,
      importance: m.importance,
      sourceChapterId: m.sourceChapterId,
    }))
  },
})
