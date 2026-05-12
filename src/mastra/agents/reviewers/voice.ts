import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function voiceReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'voice-reviewer',
    name: 'voice-reviewer',
    instructions: readPromptSync('agents/voice-reviewer.md')
      || '检查每个角色的台词和行为是否与其声音卡一致。输出 JSON 数组。',
    model,
  })
}
