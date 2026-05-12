import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function pacingReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'pacing-reviewer',
    name: 'pacing-reviewer',
    instructions: readPromptSync('agents/pacing-reviewer.md')
      || '分析章节的叙事节奏和信息密度。输出 JSON 数组。',
    model,
  })
}
