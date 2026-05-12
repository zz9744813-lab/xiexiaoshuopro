import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function chapterFixer(model: LanguageModelV1) {
  return new Agent({
    id: 'chapter-fixer',
    name: '章节修复',
    instructions: readPromptSync('agents/chapter-fixer.md')
      || '根据审查问题列表修复章节内容。输出 JSON。',
    model,
  })
}