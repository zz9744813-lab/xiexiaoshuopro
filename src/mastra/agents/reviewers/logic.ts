import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function logicReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'logic-reviewer',
    name: 'logic-reviewer',
    instructions: readPromptSync('agents/logic-reviewer.md')
      || '检查章节中的因果逻辑、时间线一致性和情节合理性。输出 JSON 数组。',
    model,
  })
}
