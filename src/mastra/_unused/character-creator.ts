import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function characterCreator(model: LanguageModelV1) {
  return new Agent({
    id: 'character-creator',
    name: '角色创建',
    instructions: readPromptSync('agents/character-creator.md')
      || '根据故事需求创建新角色，包括外观、声音卡、动机。输出 JSON。',
    model,
  })
}