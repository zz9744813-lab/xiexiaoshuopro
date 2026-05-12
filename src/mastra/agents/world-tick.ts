// mastra/agents/world-tick.ts - 世界时钟推进 Agent
import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function worldTickAgent(model: LanguageModelV1) {
  return new Agent({
    id: 'world-tick',
    name: 'world-tick',
    instructions: readPromptSync('agents/world-tick.md')
      || 'World Tick Agent — 请检查 prompts/agents/world-tick.md 是否存在',
    model,
  })
}
