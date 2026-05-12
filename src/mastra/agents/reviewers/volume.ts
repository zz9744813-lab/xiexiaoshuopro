import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'import {{ getChapterContext }} from '../../tools/'

export function volumeReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'volume-reviewer',
    name: 'volume-reviewer',
    instructions: readPromptSync('agents/volume-reviewer.md')
      || '检查章节在整卷结构中的位置和功能是否合理。输出 JSON 数组。',
    model,
  })
}
