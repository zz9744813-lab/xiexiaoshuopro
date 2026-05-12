// mastra/index.ts - Mastra 核心配置
import { Mastra } from '@mastra/core'
import { deepseekChat, deepseekReasoner } from '@/lib/models'
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
  volumeReviewer, continuityReviewer, relationshipReviewer,
} from './agents/reviewers'
import { canonFixer } from './agents/fixer/canon'
import { continuityFixer } from './agents/fixer/continuity'
import { slopFixer } from './agents/fixer/slop'
import * as tools from './tools'

// 为不同任务选择合适的模型
const draftModel = deepseekChat()
const fixerModel = deepseekChat()
const reviewModel = deepseekChat()
const reasonerModel = deepseekReasoner()

export const mastra = new Mastra({
  agents: {
    chapterDraft: chapterDraftAgent(draftModel),
    chapterSummary: chapterSummaryAgent,
    premise: premiseAgent,
    volumeOutline: volumeOutlineAgent,
    chapterOutline: chapterOutlineAgent,
    bibleExtract: bibleExtractAgent,
    hook: hookAgent,
    sectionRewriter: sectionRewriterAgent,
    director: directorAgent(reviewModel),
    narrator: narratorAgent,
    logicReviewer: logicReviewer(reviewModel),
    voiceReviewer: voiceReviewer(reviewModel),
    canonReviewer: canonReviewer(reviewModel),
    pacingReviewer: pacingReviewer(reviewModel),
    themeReviewer: themeReviewer(reviewModel),
    genreReviewer: genreReviewer(reviewModel),
    readerSimulator: readerSimulator(draftModel),
    slopReviewer: slopReviewer(reviewModel),
    volumeReviewer: volumeReviewer(reviewModel),
    continuityReviewer: continuityReviewer(reviewModel),
    relationshipReviewer: relationshipReviewer(reviewModel),
    canonFixer: canonFixer(fixerModel),
    continuityFixer: continuityFixer(fixerModel),
    slopFixer: slopFixer(fixerModel),
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