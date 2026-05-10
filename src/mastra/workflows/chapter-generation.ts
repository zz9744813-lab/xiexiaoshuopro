// mastra/workflows/chapter-generation.ts - 章节生成 Workflow
import { generateText, streamText } from 'ai'
import { getModelForTask } from '@/lib/models'
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
 * 章节生成 Workflow - 完整流水线
 * Step 1: 构建上下文 prompt
 * Step 2: 流式生成章节
 * Step 3: Slop 检测
 * Step 4: 文风指纹
 * Step 5: 生成摘要
 */
export async function runChapterGeneration(
  input: ChapterGenerationInput
): Promise<ChapterGenerationResult> {
  // Step 1: 构建 prompt
  const systemPrompt = buildChapterSystemPrompt(input)

  // Step 2: 生成章节
  const { model, temperature, maxTokens } = getModelForTask('draft', input.safetyLevel)

  const { text: content } = await generateText({
    model,
    temperature,
    maxOutputTokens: maxTokens,
    system: systemPrompt,
    prompt: '请根据以上设定，写出本章正文。',
  })

  // Step 3: Slop 检测
  const slopHits = detectSlop(content)

  // Step 4: 文风指纹
  const fingerprint = computeStyleFingerprint(content)

  // Step 5: 生成摘要
  const { model: summaryModel, temperature: summaryTemp, maxTokens: summaryMax } = getModelForTask('summary')

  let summary
  try {
    const { text: summaryText } = await generateText({
      model: summaryModel,
      temperature: summaryTemp,
      maxOutputTokens: summaryMax,
      prompt: `为以下章节生成摘要。输出JSON：{"shortSummary":"200字摘要","longSummary":"详细摘要","keyEvents":[{"event":"事件","importance":1-10}]}

章节内容：
${content.slice(0, 6000)}

直接输出JSON。`,
    })

    const jsonMatch = summaryText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      summary = JSON.parse(jsonMatch[0])
    }
  } catch {
    // 摘要生成失败不阻塞主流程
  }

  return {
    content,
    wordCount: content.length,
    slopHits: slopHits.length,
    fingerprint,
    summary,
  }
}

function buildChapterSystemPrompt(input: ChapterGenerationInput): string {
  const parts: string[] = []

  parts.push('你是一位专业的小说执笔者。请根据以下信息写出高质量的章节正文。')
  parts.push('')

  if (input.genre) {
    parts.push(`## 类型\n${input.genre}`)
    parts.push('')
  }

  if (input.voiceCard) {
    parts.push(`## 声音卡\n${input.voiceCard}`)
    parts.push('')
  }

  if (input.previousSummary) {
    parts.push(`## 上一章摘要\n${input.previousSummary}`)
    parts.push('')
  }

  if (input.outline) {
    parts.push(`## 本章细纲\n${input.outline}`)
    parts.push('')
  }

  if (input.characters) {
    parts.push(`## 涉及人物\n${input.characters}`)
    parts.push('')
  }

  if (input.worldEvents) {
    parts.push(`## 章节间发生的事\n${input.worldEvents}`)
    parts.push('')
  }

  parts.push('## 写作要求')
  parts.push('1. 直接输出 markdown 正文，不要前置说明')
  parts.push('2. 避免 AI 味表达（不禁、眼中闪烁、不由自主等）')
  parts.push('3. 章末留有钩子')
  parts.push('4. 保持人物声音一致性')

  if (input.slopBlacklist && input.slopBlacklist.length > 0) {
    parts.push(`5. 避开以下表达：${input.slopBlacklist.slice(0, 10).join('、')}`)
  }

  return parts.join('\n')
}
