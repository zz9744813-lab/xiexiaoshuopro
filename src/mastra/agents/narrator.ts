// mastra/agents/narrator.ts - 叙述化 Agent（对应 prompts/agents/scenify.md）
import { Agent } from '@mastra/core/agent'
import { readPromptSync } from '@/lib/prompts'
import { deepseekChat } from '@/lib/models'

const instructions = readPromptSync('agents/scenify.md') || '叙述化 Agent — 请检查 prompts/agents/scenify.md 文件是否存在并加载。'

export const narratorAgent = new Agent({
  id: 'narrator',
  name: 'narrator',
  instructions,
  model: deepseekChat(),
})
