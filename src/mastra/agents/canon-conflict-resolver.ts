// src/mastra/agents/canon-conflict-resolver.ts
import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function canonConflictResolver(model: LanguageModelV1) {
  return new Agent({
    id: 'canon-conflict-resolver',
    name: 'canon-conflict-resolver',
    instructions: readPromptSync('agents/canon-conflict-resolver.md')
      || 'Canon Conflict Resolver — 请检查 prompts 是否存在',
    model,
  })
}
