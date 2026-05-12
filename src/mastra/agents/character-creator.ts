// mastra/agents/character-creator.ts - 角色创建 Agent
import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function characterCreator(model: LanguageModelV1) {
  return new Agent({
    id: 'character-creator',
    name: 'character-creator',
    instructions: readPromptSync('agents/character-creator.md')
      || '角色创建 Agent — 请检查 prompts/agents/character-creator.md 是否存在',
    model,
  })
}
