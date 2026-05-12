import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function themeReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'theme-reviewer',
    name: 'theme-reviewer',
    instructions: readPromptSync('agents/reviewer/theme.md')
      || '检查本章对卷命题的贡献度。输出 JSON 数组。',
    model,
  })
}
