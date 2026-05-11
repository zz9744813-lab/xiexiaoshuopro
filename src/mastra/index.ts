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
import { worldTickAgent } from './agents/world-tick'
import { characterAgent } from './agents/character-agent'
import {
  logicReviewer, voiceReviewer, canonReviewer, pacingReviewer,
  themeReviewer, genreReviewer, readerSimulator, slopReviewer,
} from './agents/reviewers'
import * as tools from './tools'

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
    worldTick: worldTickAgent,
    characterAgent: characterAgent,
    logicReviewer,
    voiceReviewer,
    canonReviewer,
    pacingReviewer,
    themeReviewer,
    genreReviewer,
    readerSimulator,
    slopReviewer,
  },
  tools: {
    searchBible: tools.searchBible,
    getCharacterProfile: tools.getCharacterProfile,
    getRecentSummaries: tools.getRecentSummaries,
    addIssue: tools.addIssue,
    getWorldClockState: tools.getWorldClockState,
    getActiveVoiceCard: tools.getActiveVoiceCard,
    getCanonFacts: tools.getCanonFacts,
    getGenreProfile: tools.getGenreProfile,
    getChapterContext: tools.getChapterContext,
    getCharacterKnowledge: tools.getCharacterKnowledge,
    getWorldFacts: tools.getWorldFacts,
  },
})
