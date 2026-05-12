import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function slopReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'slop-reviewer',
    name: 'slop-reviewer',
    instructions: readPromptSync('agents/slop-reviewer.md')
      || '检查文本中的 AI 生成痕迹。输出 JSON 数组。',
    model,
  })
}
