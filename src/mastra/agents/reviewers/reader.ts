import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function readerSimulator(model: LanguageModelV1) {
  return new Agent({
    id: 'reader-simulator',
    name: 'reader-simulator',
    instructions: readPromptSync('agents/reader-simulator.md')
      || '模拟普通读者的阅读体验。输出 JSON 对象。',
    model,
  })
}
