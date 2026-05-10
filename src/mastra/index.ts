// mastra/index.ts - Mastra 核心配置
import { Mastra } from '@mastra/core'
import { chapterDraftAgent } from './agents/chapter-draft'
import { chapterSummaryAgent } from './agents/chapter-summary'
import { premiseAgent } from './agents/premise'
import { volumeOutlineAgent } from './agents/volume-outline'
import { chapterOutlineAgent } from './agents/chapter-outline'
import { bibleExtractAgent } from './agents/bible-extract'
import { hookAgent } from './agents/hook'
import { sectionRewriterAgent } from './agents/section-rewriter'
import { directorAgent } from './agents/director'
import { narratorAgent } from './agents/narrator'
import {
  logicReviewer, voiceReviewer, canonReviewer, pacingReviewer,
  themeReviewer, genreReviewer, readerSimulator, slopReviewer,
} from './agents/reviewers'

export const mastra = new Mastra({
  agents: {
    chapterDraft: chapterDraftAgent,
    chapterSummary: chapterSummaryAgent,
    premise: premiseAgent,
    volumeOutline: volumeOutlineAgent,
    chapterOutline: chapterOutlineAgent,
    bibleExtract: bibleExtractAgent,
    hook: hookAgent,
    sectionRewriter: sectionRewriterAgent,
    director: directorAgent,
    narrator: narratorAgent,
    logicReviewer,
    voiceReviewer,
    canonReviewer,
    pacingReviewer,
    themeReviewer,
    genreReviewer,
    readerSimulator,
    slopReviewer,
  },
})
