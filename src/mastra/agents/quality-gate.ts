import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function qualityGate(model: LanguageModelV1) {
  return new Agent({
    id: 'quality-gate',
    name: '质量把关',
    instructions: readPromptSync('agents/quality-gate.md')
      || '综合评估章节是否达到发布标准。输出 JSON。',
    model,
  })
}