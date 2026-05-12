// mastra/agents/reviewers/index.ts - 审稿团
// 每个 reviewer 从独立文件导入，便于单独维护和扩展

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

// 向后兼容：保留 reviewer 名称到函数的映射
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
import type { LanguageModelV1 } from '@ai-sdk/provider'

export const reviewerFactories: Record<string, (model: LanguageModelV1) => any> = {
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
