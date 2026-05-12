// mastra/agents/chapter-summary.ts - 章节摘要 Agent
import { Agent } from '@mastra/core/agent'
import { readPromptSync } from '@/lib/prompts'
import { deepseekChat } from '@/lib/models'

const instructions = readPromptSync('agents/chapter-summary.md')
  || '章节摘要 Agent — 请检查 prompts/agents/chapter-summary.md 是否存在'

export const chapterSummaryAgent = new Agent({
  id: 'chapter-summary',
  name: 'chapter-summary',
  instructions,
  model: deepseekChat(),
})
