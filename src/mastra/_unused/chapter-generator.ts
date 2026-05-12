import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

export function chapterGenerator(model: LanguageModelV1) {
  return new Agent({
    id: 'chapter-generator',
    name: '章节生成',
    instructions: readPromptSync('agents/chapter-generator.md')
      || '根据大纲和角色信息生成完整的章节正文。输出 JSON。',
    model,
  })
}