import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'import {{ getGenreProfile }} from '../../tools/'

export function genreReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'genre-reviewer',
    name: 'genre-reviewer',
    instructions: readPromptSync('agents/genre-reviewer.md')
      || '检查章节是否满足类型契约。输出 JSON 数组。',
    model,
  })
}
