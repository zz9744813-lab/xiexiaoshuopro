// mastra/agents/chapter-draft.ts - 章节初稿生成 Agent
import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'
import { searchBible } from '../tools/search-bible'
import { getCharacterProfile } from '../tools/get-character-profile'
import { getRecentSummaries } from '../tools/get-recent-summaries'
import { getActiveVoiceCard } from '../tools/get-voice-card'
import { getGenreProfile } from '../tools/get-genre-profile'
import { getWorldClockState } from '../tools/get-world-clock'

const instructions = readPromptSync('agents/chapter-draft.md') || `你是一位专业的小说执笔者。你的任务是根据提供的章节细纲、人物档案、世界观设定和前文摘要，写出高质量的章节初稿。

你可以使用工具来获取所需的上下文信息。

写作要求：
1. 严格遵循章节细纲中的情节安排
2. 保持人物声音一致性
3. 避免 AI 味的表达（如"不禁"、"眼中闪烁着"、"不由自主"等）
4. 章末必须留有钩子
5. 直接输出 markdown 正文，不要前置说明、不要标题`

export function chapterDraftAgent(model: LanguageModelV1) {
  return new Agent({
    id: 'chapter-draft',
    name: 'chapter-draft',
    instructions,
    model,
    tools: {
      searchBible,
      getCharacterProfile,
      getRecentSummaries,
      getActiveVoiceCard,
      getGenreProfile,
      getWorldClockState,
    },
  })
}
