// src/mastra/workflows/summarize-cascade.ts
import { mastra } from '@/mastra'
import { db } from '@/db'
import { multiLevelSummaries, chapterSummaries, chapterOutlines, chapters, volumes } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { embed } from '@/lib/embed'
import { z } from 'zod'

const SummarySchema = z.object({
  shortSummary: z.string(),
  longSummary: z.string().optional(),
  keyEvents: z.array(z.string()).default([]),
  emotionalArc: z.string().optional(),
  readerQuestions: z.array(z.string()).default([]),
})

export async function runVolumeSummarize(input: { projectId: string; volumeId: string }) {
  const volumeOutlines = await db.select({ id: chapterOutlines.id }).from(chapterOutlines).where(eq(chapterOutlines.volumeId, input.volumeId))
  if (volumeOutlines.length === 0) return { ok: false }

  const outlineIds = volumeOutlines.map(o => o.id)
  const chapterRows = await db.select({ id: chapters.id }).from(chapters).where(and(chapters.chapterOutlineId, outlineIds))
  const summaries = await db.select().from(chapterSummaries).where(and(chapterSummaries.chapterId, chapterRows.map(c => c.id)))

  const sumAgent = mastra.getAgent('chapterSummary')
  const { text } = await sumAgent.generate({
    messages: [{ role: 'user', content: `把以下${summaries.length}章的摘要压成一个卷摘要。输出 JSON。\n\n${summaries.map(s => s.shortSummary).join('\n---\n')}` }],
    runtimeContext: { projectId: input.projectId, volumeId: input.volumeId },
  })

  const m = text.match(/\{[\s\S]*\}/)
  const parsed = m ? SummarySchema.safeParse(JSON.parse(m[0])) : null
  if (!parsed?.success) return { ok: false }

  const emb = await embed(parsed.data.shortSummary).catch(() => null)
  const [volume] = await db.select().from(volumes).where(eq(volumes.id, input.volumeId))
  await db.insert(multiLevelSummaries).values({
    projectId: input.projectId,
    level: 'volume',
    title: volume?.title ?? `Volume ${input.volumeId}`,
    shortSummary: parsed.data.shortSummary,
    longSummary: parsed.data.longSummary,
    keyEvents: parsed.data.keyEvents,
    emotionalArc: parsed.data.emotionalArc,
    readerQuestions: parsed.data.readerQuestions,
    ...(emb && { embedding: emb }),
  } as any)

  return { ok: true }
}

export async function runBookSummarize(projectId: string) {
  const volumeSummaries = await db.select().from(multiLevelSummaries).where(and(eq(multiLevelSummaries.projectId, projectId), eq(multiLevelSummaries.level, 'volume')))
  if (volumeSummaries.length === 0) return { ok: false }

  const sumAgent = mastra.getAgent('chapterSummary')
  const { text } = await sumAgent.generate({
    messages: [{ role: 'user', content: `把以下${volumeSummaries.length}卷摘要压成全书 synopsis。输出 JSON。\n\n${volumeSummaries.map(v => v.shortSummary).join('\n===\n')}` }],
    runtimeContext: { projectId },
  })

  const m = text.match(/\{[\s\S]*\}/)
  const parsed = m ? SummarySchema.safeParse(JSON.parse(m[0])) : null
  if (!parsed?.success) return { ok: false }

  const emb = await embed(parsed.data.shortSummary).catch(() => null)
  await db.insert(multiLevelSummaries).values({
    projectId,
    level: 'book',
    title: 'Book summary',
    shortSummary: parsed.data.shortSummary,
    longSummary: parsed.data.longSummary,
    keyEvents: parsed.data.keyEvents,
    ...(emb && { embedding: emb }),
  } as any)

  return { ok: true }
}
