// mastra/workflows/chapter-generation.ts - 章节生成 Workflow
// 通过 Mastra Agent 调用（非流式版本，用于批量生成、测试等场景）

import { mastra } from '@/mastra'
import { detectSlop } from '@/lib/slop-detector'
import { computeStyleFingerprint } from '@/lib/style-fingerprint'

export interface ChapterGenerationInput {
  chapterId: string
  projectId: string
  outline: string
  previousSummary?: string
  characters?: string
  voiceCard?: string
  genre?: string
  safetyLevel?: string
  slopBlacklist?: string[]
  worldEvents?: string
}

export interface ChapterGenerationResult {
  content: string
  wordCount: number
  slopHits: number
  fingerprint: ReturnType<typeof computeStyleFingerprint>
  summary?: {
    shortSummary: string
    longSummary: string
    keyEvents: Array<{ event: string; importance: number }>
  }
}

/**
 * 章节生成 Workflow（非流式版本）
 * 通过 Mastra Agent 调用，prompt 全部在 agent 侧加载
 */
export async function runChapterGeneration(
  input: ChapterGenerationInput
): Promise<ChapterGenerationResult> {
  const agent = mastra.getAgent('chapterDraft')

  const contextPrompt = [
    `project_id: ${input.projectId}`,
    `chapter_id: ${input.chapterId}`,
    `genre: ${input.genre || ''}`,
    `chapter_outline: ${input.outline}`,
    `prev_chapter_summary: ${input.previousSummary || ''}`,
    `characters_present: ${input.characters || ''}`,
    `voice_card: ${input.voiceCard || ''}`,
    `between_chapter_events: ${input.worldEvents || ''}`,
  ].join('\n')

  const result = await agent.generate({
    messages: [{ role: 'user', content: contextPrompt }],
    runtimeContext: { projectId: input.projectId, chapterId: input.chapterId },
  })

  const content = result.text

  // 后处理
  const slopHits = detectSlop(content)
  const fingerprint = computeStyleFingerprint(content)

  // 摘要（通过 Mastra agent）
  let summary
  try {
    const summaryAgent = mastra.getAgent('chapterSummarizer')
    const sResult = await summaryAgent.generate({
      messages: [{ role: 'user', content: `请为以下章节生成结构化摘要。\n\n${content.slice(0, 6000)}` }],
    })
    const match = sResult.text.match(/\{[\s\S]*\}/)
    if (match) summary = JSON.parse(match[0])
  } catch { /* 摘要失败不阻塞 */ }

  return { content, wordCount: content.length, slopHits: slopHits.length, fingerprint, summary }
}