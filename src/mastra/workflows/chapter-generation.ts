// mastra/workflows/chapter-generation.ts - 章节生成 Workflow
// 注意：这个 workflow 现在是 API route 的辅助函数，不再重复构建 prompt
// 主要的章节生成逻辑在 api/chapters/[id]/generate/route.ts 中
// 这里提供独立的非流式版本（用于批量生成、测试等场景）

import { mastra } from '@/mastra'
import { getModelForTask } from '@/lib/models'
import { loadPrompt } from '@/lib/prompts'
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
 */
export async function runChapterGeneration(
  input: ChapterGenerationInput
): Promise<ChapterGenerationResult> {
  // 构建 prompt（使用 loadPrompt 或 fallback）
  const promptVars: Record<string, string> = {
    project_title: '',
    genre: input.genre || '',
    voice_card: input.voiceCard || '',
    prev_chapter_summary: input.previousSummary || '',
    chapter_outline: input.outline,
    characters_present: input.characters || '',
    target_word_count: '5000',
    hook_intent: '留下悬念',
    slop_blacklist: (input.slopBlacklist || ['不禁', '眼中闪烁着', '不由自主']).join('、'),
    between_chapter_events: input.worldEvents || '',
  }

  let systemPrompt = loadPrompt('agents/chapter-draft.md', promptVars)
  if (!systemPrompt.trim()) {
    // fallback: 内联构建
    const parts: string[] = []
    parts.push('你是一位专业的小说执笔者。')
    if (input.genre) parts.push(`\n## 类型\n${input.genre}`)
    if (input.voiceCard) parts.push(`\n## 声音卡\n${input.voiceCard}`)
    if (input.previousSummary) parts.push(`\n## 上一章摘要\n${input.previousSummary}`)
    parts.push(`\n## 本章细纲\n${input.outline}`)
    if (input.characters) parts.push(`\n## 涉及人物\n${input.characters}`)
    parts.push('\n## 写作要求\n1. 直接输出正文\n2. 避免AI味\n3. 章末留钩子')
    systemPrompt = parts.join('\n')
  }

  // 生成
  const draftAgent = mastra.getAgent('chapterDraft')
  const { text: content } = await draftAgent.generate({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请根据以上设定，写出本章正文。' }
    ],
  })

  // 后处理
  const slopHits = detectSlop(content)
  const fingerprint = computeStyleFingerprint(content)

  // 摘要（可选）
  let summary
  try {
    const summaryAgent = mastra.getAgent('chapterSummary')
    const { text: sText } = await summaryAgent.generate({
      messages: [{
        role: 'user',
        content: `为以下章节生成摘要。输出JSON：{"shortSummary":"200字摘要","longSummary":"详细摘要","keyEvents":[{"event":"事件","importance":1}]}
章节内容：${content.slice(0, 6000)}
直接输出JSON。`
      }],
    })
    const match = sText.match(/\{[\s\S]*\}/)
    if (match) summary = JSON.parse(match[0])
  } catch { /* 摘要失败不阻塞 */ }

  return { content, wordCount: content.length, slopHits: slopHits.length, fingerprint, summary }
}
