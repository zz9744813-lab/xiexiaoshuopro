import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function chapterReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'chapter-reviewer',
    name: '章节审查',
    instructions: readPromptSync('agents/chapter-reviewer.md')
      || '多维度审查章节质量，包括逻辑、声音、连续性。输出 JSON。',
    model,
  })
}