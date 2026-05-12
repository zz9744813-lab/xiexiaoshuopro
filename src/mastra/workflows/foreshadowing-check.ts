// src/mastra/workflows/foreshadowing-check.ts
import { mastra } from '@/mastra'
import { db } from '@/db'
import { foreshadowings, foreshadowingChecks } from '@/db/schema'
import { z } from 'zod'

const FSSchema = z.object({
  newForeshadowings: z.array(z.object({
    description: z.string(),
    type: z.string().optional(),
    importance: z.number().optional(),
    payoffType: z.string().optional(),
  })).default([]),
  resolutions: z.array(z.object({
    foreshadowingId: z.string(),
    quality: z.number().optional(),
    note: z.string().optional(),
  })).default([]),
  reinforcements: z.array(z.object({
    foreshadowingId: z.string(),
    note: z.string().optional(),
  })).default([]),
})

export async function runForeshadowingCheck(input: {
  projectId: string
  chapterId: string
  content: string
}) {
  const agent = mastra.getAgent('foreshadowingTracker')
  const prompt = `## 伏笔检测\nprojectId: ${input.projectId}\nchapterId: ${input.chapterId}\n\ncontent:\n${input.content.slice(0, 8000)}`

  const { text } = await agent.generate({
    messages: [{ role: 'user', content: prompt }],
    runtimeContext: { projectId: input.projectId, chapterId: input.chapterId },
  })

  const m = text.match(/\{[\s\S]*\}/)
  const parsed = m ? FSSchema.safeParse(JSON.parse(m[0])) : null
  if (!parsed?.success) return { newCount: 0, resolvedCount: 0 }

  // Insert new foreshadowings
  for (const f of parsed.data.newForeshadowings) {
    await db.insert(foreshadowings).values({
      projectId: input.projectId,
      plantedChapterId: input.chapterId,
      description: f.description,
      type: f.type,
      importance: f.importance,
      payoffType: f.payoffType,
      status: 'planted',
      plantedAt: new Date().toISOString(),
    })
  }

  // Mark resolutions
  for (const r of parsed.data.resolutions) {
    await db.update(foreshadowings).set({
      status: 'resolved',
      resolvedChapterId: input.chapterId,
      resolvedAt: new Date(),
      payoffQuality: r.quality,
    }).where(eq(foreshadowings.id, r.foreshadowingId))
  }

  await db.insert(foreshadowingChecks).values({
    projectId: input.projectId,
    currentChapterId: input.chapterId,
    findings: parsed.data,
    createdByAgent: 'foreshadowing-tracker',
  })

  return {
    newCount: parsed.data.newForeshadowings.length,
    resolvedCount: parsed.data.resolutions.length,
  }
}
