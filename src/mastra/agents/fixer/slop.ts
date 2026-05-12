import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function slopFixer(model: LanguageModelV1) {
  return new Agent({
    id: 'slop-fixer',
    name: 'slop-fixer',
    instructions: readPromptSync('agents/fixer/slop.md')
      || '根据 slop 黑名单修复章节中的陈词滥调和 AI 套话。输出 JSON。',
    model,
  })
}