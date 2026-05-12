// mastra/agents/section-rewriter.ts - 段落重写 Agent
import { Agent } from '@mastra/core/agent'
import { readPromptSync } from '@/lib/prompts'
import { deepseekChat } from '@/lib/models'

const instructions = readPromptSync('agents/section-rewriter.md')
  || '段落重写 Agent — 请检查 prompts/agents/section-rewriter.md 是否存在'

export const sectionRewriterAgent = new Agent({
  id: 'section-rewriter',
  name: 'section-rewriter',
  instructions,
  model: deepseekChat(),
})
