// mastra/agents/premise.ts - 命题生成 Agent
import { Agent } from '@mastra/core/agent'
import { readPromptSync } from '@/lib/prompts'
import { deepseekChat } from '@/lib/models'

const instructions = readPromptSync('agents/premise.md') || `你是一位资深小说策划。你的任务是根据用户提供的种子创意和类型，生成 3 个强制差异化的卷命题候选。

要求：
1. 3 个候选必须分别落在不同的方差轴上（道德/身份/体系/关系）
2. 每个候选包含：命题陈述、核心冲突、情感基调、预期读者承诺
3. 候选之间要有明显差异，给用户真正的选择空间

输出格式（JSON 数组）：
[
  {
    "id": 1,
    "thesis": "命题陈述",
    "coreConflict": "核心冲突",
    "emotionalTone": "情感基调",
    "readerPromise": "读者承诺",
    "varianceAxis": "道德|身份|体系|关系"
  }
]

直接输出 JSON，不要包裹在代码块中。`

export const premiseAgent = new Agent({
  id: 'premise',
  name: 'premise',
  instructions,
  model: deepseekChat(),
})
