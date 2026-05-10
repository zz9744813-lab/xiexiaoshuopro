// mastra/tools/get-character-profile.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { characters } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const getCharacterProfile = createTool({
  id: 'get-character-profile',
  description: '获取角色档案（支持隐私过滤）',
  inputSchema: z.object({
    characterId: z.string(),
    viewerCharacterId: z.string().optional().describe('查看者角色 ID，用于隐私过滤'),
  }),
  execute: async ({ characterId, viewerCharacterId }) => {
    const [char] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, characterId))

    if (!char) {
      return { error: `Character ${characterId} not found` }
    }

    if (viewerCharacterId && viewerCharacterId !== characterId) {
      return {
        id: char.id,
        name: char.name,
        tier: char.tier || 'walk_on',
        appearance: char.appearance,
        publicRole: char.publicRole,
        secretMotive: null,
        trueIntent: null,
      }
    }

    return {
      id: char.id,
      name: char.name,
      tier: char.tier || 'walk_on',
      appearance: char.appearance,
      publicRole: char.publicRole,
      voiceMd: char.voiceMd,
      secretMotive: char.secretMotive,
      trueIntent: char.trueIntent,
      arcGoal: char.arcGoal,
      currentEmotionalState: char.currentEmotionalState,
    }
  },
})
