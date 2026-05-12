// mastra/agents/director.ts - 推演导演 Agent
import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function directorAgent(model: LanguageModelV1) {
  return new Agent({
    id: 'director',
    name: 'director',
    instructions: readPromptSync('agents/director.md')
      || '你是推演场景导演。决定谁说话、是否注入事件、何时结束。输出 JSON。',
    model,
  })
}
