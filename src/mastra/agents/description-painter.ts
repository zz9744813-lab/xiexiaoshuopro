import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function descriptionPainter(model: LanguageModelV1) {
  return new Agent({
    id: 'description-painter',
    name: '描写渲染',
    instructions: readPromptSync('agents/description-painter.md')
      || '增强场景和情感的描写表现力。输出 JSON。',
    model,
  })
}