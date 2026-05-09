// mastra/index.ts - Mastra 核心配置
import { Mastra } from '@mastra/core'
import { chapterDraftAgent } from './agents/chapter-draft'
import { chapterSummaryAgent } from './agents/chapter-summary'
import { premiseAgent } from './agents/premise'

export const mastra = new Mastra({
  agents: {
    chapterDraft: chapterDraftAgent,
    chapterSummary: chapterSummaryAgent,
    premise: premiseAgent,
  },
})
