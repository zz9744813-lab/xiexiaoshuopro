import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function dialogueSmith(model: LanguageModelV1) {
  return new Agent({
    id: 'dialogue-smith',
    name: '对白打磨',
    instructions: readPromptSync('agents/dialogue-smith.md')
      || '根据角色声音卡打磨人物对话。输出 JSON。',
    model,
  })
}