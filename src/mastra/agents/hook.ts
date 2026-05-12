// mastra/agents/hook.ts - 章末钩子 Agent
import { Agent } from '@mastra/core/agent'
import { readPromptSync } from '@/lib/prompts'
import { deepseekChat } from '@/lib/models'

const instructions = readPromptSync('agents/hook.md')
  || '钩子 Agent — 请检查 prompts/agents/hook.md 是否存在'

export const hookAgent = new Agent({
  id: 'hook',
  name: 'hook',
  instructions,
  model: deepseekChat(),
})
