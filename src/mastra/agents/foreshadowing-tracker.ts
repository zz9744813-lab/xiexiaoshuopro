// src/mastra/agents/foreshadowing-tracker.ts
import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function foreshadowingTracker(model: LanguageModelV1) {
  return new Agent({
    id: 'foreshadowing-tracker',
    name: 'foreshadowing-tracker',
    instructions: readPromptSync('agents/foreshadowing-tracker.md')
      || 'Foreshadowing Tracker — 请检查 prompts 是否存在',
    model,
  })
}
