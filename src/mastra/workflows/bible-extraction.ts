// src/mastra/workflows/bible-extraction.ts
import { mastra } from '@/mastra'
import { db } from '@/db'
import { canonFacts, worldEntries } from '@/db/schema'
import { embed } from '@/lib/embed'
import { z } from 'zod'

const ExtractSchema = z.object({
  canonFacts: z.array(z.object({
    fact: z.string(),
    category: z.string().optional(),
    immutable: z.boolean().default(false),
  })).default([]),
  worldEntries: z.array(z.object({
    kind: z.enum(['location','item','concept','magic','faction','rule']),
    name: z.string(),
    description: z.string().optional(),
    rules: z.string().optional(),
  })).default([]),
})

export async function runBibleExtraction(input: {
  chapterContent: string
  chapterTitle: string
  projectId: string
  chapterId: string
  chapterNumber: number
}) {
  const agent = mastra.getAgent('bibleExtract')
  const prompt = `## Bible 抽取
chapter_title: ${input.chapterTitle}
chapter_number: ${input.chapterNumber}
content: ${input.chapterContent.slice(0, 8000)}

从以上章节抽取：
1. canonFacts: 新确立的硬性事实
2. worldEntries: 新出现的 location/item/magic/faction/concept/rule

直接输出 JSON。`

  const { text } = await agent.generate({
    messages: [{ role: 'user', content: prompt }],
    runtimeContext: { projectId: input.projectId, chapterId: input.chapterId },
  })

  const m = text.match(/\{[\s\S]*\}/)
  const parsed = m ? ExtractSchema.safeParse(JSON.parse(m[0])) : null
  if (!parsed?.success) {
    return { factsInserted: 0, entriesInserted: 0 }
  }

  let factCount = 0, entryCount = 0
  for (const cf of parsed.data.canonFacts) {
    const emb = await embed(cf.fact).catch(() => null)
    await db.insert(canonFacts).values({
      projectId: input.projectId,
      fact: cf.fact,
      category: cf.category ?? 'general',
      sourceChapterId: input.chapterId,
      immutable: cf.immutable,
      ...(emb ? { embedding: emb } : {}),
    } as any)
    factCount++
  }
  for (const we of parsed.data.worldEntries) {
    const emb = await embed(`${we.name}: ${we.description ?? ''}`).catch(() => null)
    await db.insert(worldEntries).values({
      projectId: input.projectId,
      kind: we.kind,
      name: we.name,
      description: we.description,
      rules: we.rules,
      firstAppearanceChapterId: input.chapterId,
      ...(emb ? { embedding: emb } : {}),
    } as any)
    entryCount++
  }

  return { factsInserted: factCount, entriesInserted: entryCount }
}
