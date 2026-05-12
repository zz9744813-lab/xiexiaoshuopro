// mastra/agents/bible-extract.ts - Bible 抽取 Agent
import { Agent } from '@mastra/core/agent'
import { readPromptSync } from '@/lib/prompts'
import { deepseekChat } from '@/lib/models'

const instructions = readPromptSync('agents/bible-extract.md')
  || 'Bible 抽取 Agent — 请检查 prompts/agents/bible-extract.md 是否存在'

export const bibleExtractAgent = new Agent({
  id: 'bible-extract',
  name: 'bible-extract',
  instructions,
  model: deepseekChat(),
})
