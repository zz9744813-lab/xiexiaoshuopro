// mastra/agents/relationship-mapper.ts - 关系映射 Agent
import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function relationshipMapper(model: LanguageModelV1) {
  return new Agent({
    id: 'relationship-mapper',
    name: 'relationship-mapper',
    instructions: readPromptSync('agents/relationship-mapper.md')
      || '关系映射 Agent — 请检查 prompts/agents/relationship-mapper.md 是否存在',
    model,
  })
}
