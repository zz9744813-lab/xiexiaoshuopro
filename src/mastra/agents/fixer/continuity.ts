import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function continuityFixer(model: LanguageModelV1) {
  return new Agent({
    id: 'continuity-fixer',
    name: 'continuity-fixer',
    instructions: readPromptSync('agents/fixer/continuity.md')
      || '修复章节中的连续性中断。输出 JSON。',
    model,
  })
}