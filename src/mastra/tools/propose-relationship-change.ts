// src/mastra/tools/propose-relationship-change.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { characterRelationships } from '@/db/schema'

export const proposeRelationshipChange = createTool({
  id: 'propose-relationship-change',
  description: '提议更新角色关系',
  inputSchema: z.object({
    characterA: z.string(),
    characterB: z.string(),
    warmthDelta: z.number().optional(),
    trustDelta: z.number().optional(),
    note: z.string().optional(),
  }),
  execute: async ({ characterA, characterB, warmthDelta, trustDelta, note }) => {
    const [existing] = await db.select().from(characterRelationships)
      .where(and(eq(characterRelationships.characterA, characterA), eq(characterRelationships.characterB, characterB)))
    if (existing) {
      await db.update(characterRelationships).set({
        warmth: (existing.warmth ?? 0) + (warmthDelta ?? 0),
        trust: (existing.trust ?? 0) + (trustDelta ?? 0),
      }).where(eq(characterRelationships.id, existing.id))
    }
    return { ok: true }
  },
})
