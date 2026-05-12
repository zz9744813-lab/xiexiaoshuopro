// mastra/tools/get-character-roster.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { characters } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const getCharacterRoster = createTool({
  id: 'get-character-roster',
  description: '列出项目的所有角色',
  inputSchema: z.object({
    projectId: z.string(),
    tier: z.enum(['main', 'supporting', 'walk_on']).optional(),
  }),
  execute: async ({ projectId, tier }) => {
    let roster = await db
      .select({
        id: characters.id,
        name: characters.name,
        tier: characters.tier,
        publicRole: characters.publicRole,
        alive: characters.alive,
        appearanceCount: characters.appearanceCount,
      })
      .from(characters)
      .where(eq(characters.projectId, projectId))

    if (tier) {
      roster = roster.filter(c => c.tier === tier)
    }

    return roster
  },
})
