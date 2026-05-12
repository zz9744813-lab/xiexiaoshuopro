// src/mastra/agents/relationship-update.ts
import { Agent } from '@mastra/core/agent'
import { readPromptSync } from '@/lib/prompts'
import { deepseekChat } from '@/lib/models'

const instructions = readPromptSync('agents/relationship-update.md')
  || 'Relationship Update Agent — 请检查 prompts/agents/relationship-update.md'

export const relationshipUpdateAgent = new Agent({
  id: 'relationship-update',
  name: 'relationship-update',
  instructions,
  model: deepseekChat(),
})
