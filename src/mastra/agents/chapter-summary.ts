// mastra/agents/chapter-summary.ts - 章节摘要 Agent
import { Agent } from '@mastra/core/agent'
import { readPromptSync } from '@/lib/prompts'
import { deepseekChat } from '@/lib/models'

const instructions = readPromptSync('agents/chapter-summary.md') || `你是一位小说编辑助手。你的任务是为已完成的章节生成结构化摘要。

输出格式（JSON）：
{
  "shortSummary": "200字以内的简短摘要，供下一章生成时使用",
  "longSummary": "1000字以内的详细摘要，供卷审时使用",
  "emotionalArc": "本章情感曲线描述",
  "keyEvents": [{"event": "事件描述", "importance": 1-10}],
  "readerQuestionsRaised": ["留给读者的悬念"],
  "readerQuestionsAnswered": ["本章解答的悬念"]
}

直接输出 JSON，不要包裹在代码块中。`

export const chapterSummaryAgent = new Agent({
  id: 'chapter-summary',
  name: 'chapter-summary',
  instructions,
  model: deepseekChat(),
})
