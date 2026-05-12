import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function canonFixer(model: LanguageModelV1) {
  return new Agent({
    id: 'canon-fixer',
    name: 'canon-fixer',
    instructions: readPromptSync('agents/fixer/canon.md')
      || '修复章节中与 canon facts 矛盾的内容。输出 JSON。',
    model,
  })
}