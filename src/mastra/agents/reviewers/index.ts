// mastra/agents/reviewers/index.ts - 审稿团
import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'
import { getCanonFacts } from '../../tools/get-canon-facts'
import { getActiveVoiceCard } from '../../tools/get-voice-card'
import { getGenreProfile } from '../../tools/get-genre-profile'
import { addIssue } from '../../tools/add-issue'

// 所有 reviewer 共享的 tool 集合
const reviewTools = {
  getCanonFacts,
  getActiveVoiceCard,
  getGenreProfile,
  addIssue,
}

// 逻辑审查
export function logicReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'logic-reviewer',
    name: 'logic-reviewer',
    instructions: readPromptSync('agents/logic-reviewer.md')
      || '检查章节中的因果逻辑、时间线一致性和情节合理性。输出 JSON 数组。',
    model,
  })
}

// 声音审查
export function voiceReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'voice-reviewer',
    name: 'voice-reviewer',
    instructions: readPromptSync('agents/voice-reviewer.md')
      || '检查每个角色的台词和行为是否与其声音卡一致。输出 JSON 数组。',
    model,
  })
}

// 设定审查
export function canonReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'canon-reviewer',
    name: 'canon-reviewer',
    instructions: readPromptSync('agents/canon-reviewer.md')
      || '检查章节内容是否与已确立的 canon facts 矛盾。输出 JSON 数组。',
    model,
  })
}

// 节奏审查
export function pacingReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'pacing-reviewer',
    name: 'pacing-reviewer',
    instructions: readPromptSync('agents/pacing-reviewer.md')
      || '分析章节的叙事节奏和信息密度。输出 JSON 数组。',
    model,
  })
}

// 主题审查
export function themeReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'theme-reviewer',
    name: 'theme-reviewer',
    instructions: readPromptSync('agents/theme-reviewer.md')
      || '检查本章对卷命题的贡献度。输出 JSON 数组。',
    model,
  })
}

// 类型审查
export function genreReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'genre-reviewer',
    name: 'genre-reviewer',
    instructions: readPromptSync('agents/genre-reviewer.md')
      || '检查章节是否满足类型契约。输出 JSON 数组。',
    model,
  })
}

// 读者模拟
export function readerSimulator(model: LanguageModelV1) {
  return new Agent({
    id: 'reader-simulator',
    name: 'reader-simulator',
    instructions: readPromptSync('agents/reader-simulator.md')
      || '模拟普通读者的阅读体验。输出 JSON 对象。',
    model,
  })
}

// AI 味检测
export function slopReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'slop-reviewer',
    name: 'slop-reviewer',
    instructions: readPromptSync('agents/slop-reviewer.md')
      || '检查文本中的 AI 生成痕迹。输出 JSON 数组。',
    model,
  })
}
