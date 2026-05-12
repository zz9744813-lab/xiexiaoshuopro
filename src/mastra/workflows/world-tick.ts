// src/mastra/workflows/world-tick.ts
import { mastra } from '@/mastra'
import { db } from '@/db'
import { worldClock, betweenChapterEvents } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const EventSchema = z.object({
  events: z.array(z.object({
    eventText: z.string(),
    visibility: z.enum(['hidden', 'hinted', 'revealed']).default('hidden'),
    visibleToCharacters: z.array(z.string()).default([]),
  })).default([]),
  newWorldDate: z.string().optional(),
})

export async function runWorldTick(input: {
  projectId: string
  chapterId: string
  content: string
}) {
  const agent = mastra.getAgent('worldTick')

  const prompt = `章节定稿后，判断章节间过去多久、其他势力/角色在做什么。
输出 JSON：{ events: [{eventText, visibility, visibleToCharacters}], newWorldDate }
0-3 条事件。

content:
${input.content.slice(0, 6000)}`

  const { text } = await agent.generate({
    messages: [{ role: 'user', content: prompt }],
    runtimeContext: { projectId: input.projectId, chapterId: input.chapterId },
  })

  const m = text.match(/\{[\s\S]*\}/)
  const parsed = m ? EventSchema.safeParse(JSON.parse(m[0])) : null
  if (!parsed?.success) return { eventCount: 0 }

  for (const ev of parsed.data.events) {
    await db.insert(betweenChapterEvents).values({
      projectId: input.projectId,
      afterChapterId: input.chapterId,
      eventText: ev.eventText,
      visibility: ev.visibility,
      visibleToCharacters: ev.visibleToCharacters,
      createdByAgent: 'world-tick',
    })
  }

  const [existing] = await db.select().from(worldClock)
    .where(eq(worldClock.projectId, input.projectId))
  if (existing) {
    await db.update(worldClock).set({
      currentChapterId: input.chapterId,
      currentWorldDate: parsed.data.newWorldDate ?? existing.currentWorldDate,
    }).where(eq(worldClock.projectId, input.projectId))
  } else {
    await db.insert(worldClock).values({
      projectId: input.projectId,
      currentChapterId: input.chapterId,
      currentWorldDate: parsed.data.newWorldDate,
    })
  }

  return { eventCount: parsed.data.events.length }
}
