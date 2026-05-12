import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function readerProxy(model: LanguageModelV1) {
  return new Agent({
    id: 'reader-proxy',
    name: '读者代理',
    instructions: readPromptSync('agents/reader-proxy.md')
      || '模拟目标读者群体的反应和感受。输出 JSON。',
    model,
  })
}