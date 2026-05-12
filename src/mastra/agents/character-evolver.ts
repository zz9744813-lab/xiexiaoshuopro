// mastra/agents/character-evolver.ts - 角色演化 Agent
import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function characterEvolver(model: LanguageModelV1) {
  return new Agent({
    id: 'character-evolver',
    name: 'character-evolver',
    instructions: readPromptSync('agents/character-evolver.md')
      || '角色演化 Agent — 请检查 prompts/agents/character-evolver.md 是否存在',
    model,
  })
}
