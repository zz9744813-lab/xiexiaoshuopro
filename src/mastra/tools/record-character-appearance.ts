// src/mastra/tools/record-character-appearance.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const recordCharacterAppearance = createTool({
  id: 'record-character-appearance',
  description: '记录角色外观',
  inputSchema: z.object({
    characterId: z.string(),
    appearance: z.string(),
    chapterId: z.string().optional(),
  }),
  execute: async ({ characterId, appearance, chapterId }) => {
    // TODO: insert into character_appearances table
    return { ok: true, characterId, appearance }
  },
})
