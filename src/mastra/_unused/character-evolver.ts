import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function characterEvolver(model: LanguageModelV1) {
  return new Agent({
    id: 'character-evolver',
    name: '角色演化',
    instructions: readPromptSync('agents/character-evolver.md')
      || '跟踪并推进角色的状态变化和成长弧线。输出 JSON。',
    model,
  })
}