import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function worldBuilder(model: LanguageModelV1) {
  return new Agent({
    id: 'world-builder',
    name: '世界构建',
    instructions: readPromptSync('agents/world-builder.md')
      || '构建和扩展故事世界的地理、历史、文化设定。输出 JSON。',
    model,
  })
}