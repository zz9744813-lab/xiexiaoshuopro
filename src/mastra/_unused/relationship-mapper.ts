import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function relationshipMapper(model: LanguageModelV1) {
  return new Agent({
    id: 'relationship-mapper',
    name: '关系绘制',
    instructions: readPromptSync('agents/relationship-mapper.md')
      || '分析和更新角色之间的关系状态。输出 JSON。',
    model,
  })
}