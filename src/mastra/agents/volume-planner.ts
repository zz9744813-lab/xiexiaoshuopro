import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function volumePlanner(model: LanguageModelV1) {
  return new Agent({
    id: 'volume-planner',
    name: '卷规划',
    instructions: readPromptSync('agents/volume-planner.md')
      || '规划整卷的故事结构、章节分配和叙事弧线。输出 JSON。',
    model,
  })
}