// mastra/tools/get-voice-card.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { voiceCards, projects } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export const getActiveVoiceCard = createTool({
  id: 'get-active-voice-card',
  description: '获取指定范围的声音卡',
  inputSchema: z.object({
    projectId: z.string(),
    scope: z.enum(['project', 'character', 'narrator']),
    scopeId: z.string().optional(),
  }),
  execute: async ({ projectId, scope, scopeId }) => {
    // 先尝试获取 voice_cards 表中的
    const cards = await db
      .select()
      .from(voiceCards)
      .where(eq(voiceCards.projectId, projectId))

    const matched = cards.find(c =>
      c.scope === scope && (scope === 'project' || c.scopeId === scopeId)
    )

    if (matched) {
      return {
        id: matched.id,
        scope: matched.scope,
        cardMd: matched.cardMd,
        positiveSamples: matched.positiveSamples,
        negativeSamples: matched.negativeSamples,
        preferredSentenceLength: matched.preferredSentenceLength,
      }
    }

    // fallback: 从 project.voiceMd 读取
    if (scope === 'project') {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))

      return {
        id: null,
        scope: 'project',
        cardMd: project?.voiceMd || null,
        positiveSamples: null,
        negativeSamples: null,
        preferredSentenceLength: null,
      }
    }

    return { id: null, scope, cardMd: null, positiveSamples: null, negativeSamples: null, preferredSentenceLength: null }
  },
})
