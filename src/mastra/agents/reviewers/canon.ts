import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'import {{ getCanonFacts, getWorldFacts }} from '../../tools/'

export function canonReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'canon-reviewer',
    name: 'canon-reviewer',
    instructions: readPromptSync('agents/canon-reviewer.md')
      || '检查章节内容是否与已确立的 canon facts 矛盾。输出 JSON 数组。',
    model,
  })
}
