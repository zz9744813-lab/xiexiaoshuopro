import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function tensionArcher(model: LanguageModelV1) {
  return new Agent({
    id: 'tension-archer',
    name: '张力管理',
    instructions: readPromptSync('agents/tension-archer.md')
      || '分析和管理章节的叙事张力曲线。输出 JSON。',
    model,
  })
}