// mastra/agents/reviewers/index.ts — 审稿团统一导出

// Re-export all reviewer factories
export { logicReviewer } from './logic'
export { voiceReviewer } from './voice'
export { canonReviewer } from './canon'
export { pacingReviewer } from './pacing'
export { themeReviewer } from './theme'
export { genreReviewer } from './genre'
export { readerSimulator } from './reader'
export { slopReviewer } from './slop'
export { volumeReviewer } from './volume'
export { continuityReviewer } from './continuity'
export { relationshipReviewer } from './relationship'

import type { LanguageModelV1 } from '@ai-sdk/provider'
import { logicReviewer } from './logic'
import { voiceReviewer } from './voice'
import { canonReviewer } from './canon'
import { pacingReviewer } from './pacing'
import { themeReviewer } from './theme'
import { genreReviewer } from './genre'
import { readerSimulator } from './reader'
import { slopReviewer } from './slop'
import { volumeReviewer } from './volume'
import { continuityReviewer } from './continuity'
import { relationshipReviewer } from './relationship'

/** 向后兼容：reviewer 名称到工厂函数的映射 */
export const reviewerFactories: Record<string, (model: LanguageModelV1) => ReturnType<typeof logicReviewer>> = {
  logic: logicReviewer,
  voice: voiceReviewer,
  canon: canonReviewer,
  pacing: pacingReviewer,
  theme: themeReviewer,
  genre: genreReviewer,
  reader: readerSimulator,
  slop: slopReviewer,
  volume: volumeReviewer,
  continuity: continuityReviewer,
  relationship: relationshipReviewer,
}
