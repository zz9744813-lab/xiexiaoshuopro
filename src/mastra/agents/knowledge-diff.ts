// src/mastra/agents/knowledge-diff.ts
import { Agent } from '@mastra/core/agent'
import { readPromptSync } from '@/lib/prompts'
import type { LanguageModelV1 } from '@ai-sdk/provider'

export function knowledgeDiffAgent(model: LanguageModelV1) {
  return new Agent({
    id: 'knowledge-diff',
    name: 'knowledge-diff',
    instructions: readPromptSync('agents/knowledge-diff.md')
      || 'Knowledge Diff Agent — 请检查 prompts/agents/knowledge-diff.md 是否存在',
    model,
  })
}
