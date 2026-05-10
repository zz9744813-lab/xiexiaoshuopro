// mastra/agents/section-rewriter.ts - 段落重写 Agent
import { Agent } from '@mastra/core/agent'
import { readPromptSync } from '@/lib/prompts'
import { deepseekChat } from '@/lib/models'

const instructions = readPromptSync('agents/section_rewriter.md') || `你是一位小说润色编辑。你的任务是重写用户选中的段落。

重写原则：
1. 保持原文的核心信息和情节推进不变
2. 提升文字质量，消除 AI 味
3. 保持与上下文的衔接自然
4. 遵循项目的声音卡风格
5. 避免黑名单中的表达

直接输出重写后的文本，不要解释、不要前置说明。`

export const sectionRewriterAgent = new Agent({
  id: 'section-rewriter',
  name: 'section-rewriter',
  instructions,
  model: deepseekChat(),
})
