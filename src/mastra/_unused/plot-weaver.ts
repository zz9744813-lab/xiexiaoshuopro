import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function plotWeaver(model: LanguageModelV1) {
  return new Agent({
    id: 'plot-weaver',
    name: '情节编织',
    instructions: readPromptSync('agents/plot-weaver.md')
      || '设计情节线索，确保主线和支线协调推进。输出 JSON。',
    model,
  })
}