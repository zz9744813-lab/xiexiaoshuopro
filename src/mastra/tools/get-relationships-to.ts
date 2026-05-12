// mastra/tools/get-relationships-to.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { characterRelationships, characters } from '@/db/schema'
import { eq, or, and } from 'drizzle-orm'

export const getRelationshipsTo = createTool({
  id: 'get-relationships-to',
  description: '获取角色与另一个角色的所有关系',
  inputSchema: z.object({
    characterId: z.string(),
    targetCharacterId: z.string(),
  }),
  execute: async ({ characterId, targetCharacterId }) => {
    const rels = await db
      .select()
      .from(characterRelationships)
      .where(
        or(
          and(
            eq(characterRelationships.characterA, characterId),
            eq(characterRelationships.characterB, targetCharacterId),
          ),
          and(
            eq(characterRelationships.characterA, targetCharacterId),
            eq(characterRelationships.characterB, characterId),
          ),
        )
      )

    return rels.map(r => ({
      id: r.id,
      relationType: r.relationType,
      warmth: r.warmth,
      trust: r.trust,
      historyMd: r.historyMd,
      direction: r.characterA === characterId ? 'outgoing' : 'incoming',
    }))
  },
})
