// mastra/tools/get-character-voice-anchors.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { characterVoiceAnchors } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export const getCharacterVoiceAnchors = createTool({
  id: 'get-character-voice-anchors',
  description: '获取角色的声音锚点样本',
  inputSchema: z.object({
    characterId: z.string(),
    canonicalOnly: z.boolean().default(false),
    limit: z.number().default(5),
  }),
  execute: async ({ characterId, canonicalOnly, limit }) => {
    let anchors = await db
      .select()
      .from(characterVoiceAnchors)
      .where(eq(characterVoiceAnchors.characterId, characterId))

    if (canonicalOnly) {
      anchors = anchors.filter(a => a.isCanonical)
    }

    return anchors.slice(0, limit).map(a => ({
      id: a.id,
      sampleText: a.sampleText,
      context: a.context,
      isCanonical: a.isCanonical,
    }))
  },
})
