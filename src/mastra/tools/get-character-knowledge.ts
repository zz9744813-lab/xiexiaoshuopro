// mastra/tools/get-character-knowledge.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { characterKnowledge, characterRelationships, characters } from '@/db/schema'
import { eq, and, or } from 'drizzle-orm'

export const getCharacterKnowledge = createTool({
  id: 'get-character-knowledge',
  description: '获取角色的知识库（以角色视角看世界）',
  inputSchema: z.object({
    characterId: z.string(),
    category: z.enum(['fact', 'suspected', 'lie']).optional(),
    limit: z.number().default(20),
  }),
  execute: async ({ characterId, category, limit }) => {
    // 获取角色的知识
    let knowledge = await db
      .select()
      .from(characterKnowledge)
      .where(eq(characterKnowledge.characterId, characterId))

    if (category) {
      knowledge = knowledge.filter(k => k.category === category)
    }

    // 按确定性和重要性排序
    knowledge = knowledge
      .sort((a, b) => (b.certainty || 0) - (a.certainty || 0))
      .slice(0, limit)

    // 获取角色关系
    const relationships = await db
      .select()
      .from(characterRelationships)
      .where(
        or(
          eq(characterRelationships.characterA, characterId),
          eq(characterRelationships.characterB, characterId)
        )
      )

    // 获取相关角色信息
    const relatedCharacterIds = relationships.map(r =>
      r.characterA === characterId ? r.characterB : r.characterA
    )

    const relatedCharacters = relatedCharacterIds.length > 0
      ? await db
          .select({ id: characters.id, name: characters.name, appearance: characters.appearance })
          .from(characters)
          .where(eq(characters.id, relatedCharacterIds[0]))
          .then(chars => chars.filter(c => relatedCharacterIds.includes(c.id)))
      : []

    return {
      knowledge: knowledge.map(k => ({
        id: k.id,
        category: k.category,
        content: k.content,
        certainty: k.certainty,
        sourceEvent: k.sourceEvent,
      })),
      relationships: relationships.map(r => {
        const otherId = r.characterA === characterId ? r.characterB : r.characterA
        const other = relatedCharacters.find(c => c.id === otherId)
        return {
          with: other?.name || '未知',
          relationType: r.relationType,
          warmth: r.warmth,
          trust: r.trust,
        }
      }),
    }
  },
})
