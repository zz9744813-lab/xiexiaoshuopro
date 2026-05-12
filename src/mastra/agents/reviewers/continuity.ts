import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'import {{ getRecentSummaries, getWorldClock }} from '../../tools/'

export function continuityReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'continuity-reviewer',
    name: 'continuity-reviewer',
    instructions: readPromptSync('agents/reviewer/continuity.md')
      || '检查章节之间的人物状态、情节线和伏笔是否连续。输出 JSON 数组。',
    model,
  })
}
