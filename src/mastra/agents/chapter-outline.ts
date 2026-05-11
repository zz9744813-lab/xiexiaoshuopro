// mastra/agents/chapter-outline.ts - 章节细纲 Agent
import { Agent } from '@mastra/core/agent'
import { readPromptSync } from '@/lib/prompts'
import { deepseekChat } from '@/lib/models'

const instructions = readPromptSync('agents/chapter-outline.md') || `你是一位小说架构师。你的任务是从卷弧拆分章节细纲。

每章细纲包含：
- 章节号和标题
- 情节 beats（markdown）
- 目标字数
- POV 角色
- 出场人物
- 场景标记（对话/动作/描写/蒙太奇）
- 章末钩子意图

确保：
1. 每章有明确的推进目标
2. 场景类型多样化
3. 钩子设计吸引读者继续阅读
4. 整体节奏符合类型契约`

export const chapterOutlineAgent = new Agent({
  id: 'chapter-outline',
  name: 'chapter-outline',
  instructions,
  model: deepseekChat(),
})
