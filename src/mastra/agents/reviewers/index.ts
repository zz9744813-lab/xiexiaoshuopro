// mastra/agents/reviewers/index.ts - 审稿团
import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
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
const logicInstructions = `你是一位逻辑审查员。检查章节中的因果逻辑、时间线一致性和情节合理性。

检查项：
1. 因果关系是否成立
2. 时间线是否矛盾
3. 角色行为是否有合理动机
4. 是否有未解释的突然变化

输出 JSON 数组，每个 issue 包含：
[{"title": "问题标题", "severity": "critical|warning|info", "description": "详细描述", "evidence": "引用原文", "proposedFix": "修复建议"}]

如果没有问题，输出空数组 []。`

export function logicReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'logic-reviewer',
    name: 'logic-reviewer',
    instructions: logicInstructions,
    model,
  })
}

// 声音审查
const voiceInstructions = `你是一位角色声音审查员。检查每个角色的台词和行为是否与其声音卡一致。

检查项：
1. 台词用语是否符合角色身份
2. 行为模式是否一致
3. 情感表达是否符合角色性格
4. 是否有"串戏"（角色 A 说了角色 B 的话）

输出 JSON 数组：
[{"title": "问题标题", "severity": "critical|warning|info", "description": "详细描述", "evidence": "引用原文", "proposedFix": "修复建议"}]`

export function voiceReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'voice-reviewer',
    name: 'voice-reviewer',
    instructions: voiceInstructions,
    model,
  })
}

// 设定审查
const canonInstructions = `你是一位设定审查员。检查章节内容是否与已确立的 canon facts 矛盾。

检查项：
1. 角色属性是否与档案一致（年龄、外貌、能力）
2. 地点描述是否与世界观一致
3. 体系规则是否被违反
4. 时间线事件是否矛盾

输出 JSON 数组：
[{"title": "问题标题", "severity": "critical|warning|info", "description": "详细描述", "evidence": "引用原文", "proposedFix": "修复建议"}]`

export function canonReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'canon-reviewer',
    name: 'canon-reviewer',
    instructions: canonInstructions,
    model,
  })
}

// 节奏审查
const pacingInstructions = `你是一位节奏审查员。分析章节的叙事节奏和信息密度。

检查项：
1. 场景转换是否流畅
2. 信息密度是否均匀（避免信息倾泻）
3. 紧张-松弛节奏是否合理
4. 章节长度是否与内容匹配
5. 是否有拖沓或过于仓促的段落

输出 JSON 数组：
[{"title": "问题标题", "severity": "critical|warning|info", "description": "详细描述", "evidence": "引用原文", "proposedFix": "修复建议"}]`

export function pacingReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'pacing-reviewer',
    name: 'pacing-reviewer',
    instructions: pacingInstructions,
    model,
  })
}

// 主题审查
const themeInstructions = `你是一位主题审查员。检查本章对卷命题的贡献度。

检查项：
1. 本章是否推进了卷命题
2. 主题表达是否过于直白（说教）
3. 是否有与主题矛盾的情节
4. 象征和隐喻是否恰当

输出 JSON 数组：
[{"title": "问题标题", "severity": "critical|warning|info", "description": "详细描述", "evidence": "引用原文", "proposedFix": "修复建议"}]`

export function themeReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'theme-reviewer',
    name: 'theme-reviewer',
    instructions: themeInstructions,
    model,
  })
}

// 类型审查
const genreInstructions = `你是一位类型审查员。检查章节是否满足类型契约。

检查项：
1. 是否包含类型必备元素
2. 是否违反类型禁忌
3. 类型期待是否被满足
4. 是否有与类型不符的元素

输出 JSON 数组：
[{"title": "问题标题", "severity": "critical|warning|info", "description": "详细描述", "evidence": "引用原文", "proposedFix": "修复建议"}]`

export function genreReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'genre-reviewer',
    name: 'genre-reviewer',
    instructions: genreInstructions,
    model,
  })
}

// 读者模拟
const readerInstructions = `你是一位普通读者。读完这章后，模拟你的阅读体验。

评估：
1. 是否想继续读下一章？为什么？
2. 有哪些疑问被提出？
3. 有哪些疑问被解答？
4. 情感体验如何？
5. 是否有困惑或出戏的地方？

输出 JSON：
{
  "wantToContinue": true/false,
  "reason": "原因",
  "questionsRaised": ["悬念1", "悬念2"],
  "questionsAnswered": ["解答1"],
  "emotionalResponse": "情感描述",
  "confusingParts": [{"title": "问题", "severity": "warning", "description": "描述", "evidence": "原文", "proposedFix": "建议"}]
}`

export function readerSimulator(model: LanguageModelV1) {
  return new Agent({
    id: 'reader-simulator',
    name: 'reader-simulator',
    instructions: readerInstructions,
    model,
  })
}

// AI 味检测（增强版，配合 slop-detector）
const slopInstructions = `你是一位 AI 味检测专家。检查文本中的 AI 生成痕迹。

检查项：
1. 重复的句式结构
2. 过度使用的修辞模式
3. 不自然的情感描写
4. 过于工整的段落结构
5. 缺乏个性的叙述

输出 JSON 数组：
[{"title": "问题标题", "severity": "critical|warning|info", "description": "详细描述", "evidence": "引用原文", "proposedFix": "修复建议"}]`

export function slopReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'slop-reviewer',
    name: 'slop-reviewer',
    instructions: slopInstructions,
    model,
  })
}
