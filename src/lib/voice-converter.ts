// lib/voice-converter.ts - Voice MD → JSON 结构化转换
import type { VoiceProfile, VoiceConversionInput, VoiceConversionResult } from '@/types/voice'

/**
 * 将 voiceMd 渲染为适用于 prompt 的结构化字符串
 * 优先使用 voiceProfile（结构化 JSON），fallback 到 raw voiceMd
 */
export function voiceToPromptText(voiceMd: string, voiceProfile?: VoiceProfile): string {
  if (voiceProfile) {
    return buildStructuredVoice(voiceProfile)
  }

  // fallback: 原始 voiceMd
  return voiceMd || '自然说话'
}

/**
 * 从 VoiceProfile 构建 prompt 中的结构化声音描述
 */
function buildStructuredVoice(profile: VoiceProfile): string {
  const lines: string[] = []

  lines.push(`**语气基调**：${profile.tone}`)
  lines.push(`**说话风格**：${profile.style}`)

  if (profile.sentencePatterns) {
    const sp = profile.sentencePatterns
    if (sp.sentenceLength) lines.push(`**句式长度**：${sp.sentenceLength === 'short' ? '短句为主' : sp.sentenceLength === 'long' ? '长句为主' : '正常'}
`)
    if (sp.preferredOpeners?.length) lines.push(`**常用开头**：${sp.preferredOpeners.join('、')}`)
    if (sp.preferredEndings?.length) lines.push(`**习惯结尾**：${sp.preferredEndings.join('、')}`)
  }

  if (profile.vocabulary) {
    const v = profile.vocabulary
    if (v.signaturePhrases?.length) lines.push(`**口头禅**：${v.signaturePhrases.join('、')}`)
    if (v.avoidedWords?.length) lines.push(`**避免用词**：${v.avoidedWords.join('、')}`)
    if (v.register) lines.push(`**用词风格**：${v.register}`)
  }

  if (profile.mannerisms) {
    const m = profile.mannerisms
    if (m.actionCues?.length) lines.push(`**习惯动作**：${m.actionCues.join('、')}`)
    if (m.emotionalExpressiveness) {
      const emoMap = { overt: '外放', subtle: '内敛', conflicted: '矛盾' }
      lines.push(`**情绪表达**：${emoMap[m.emotionalExpressiveness]}`)
    }
  }

  if (profile.rawNotes) lines.push(`**补充**：${profile.rawNotes}`)

  return lines.join('\n')
}

/**
 * 将 voiceMd 通过 LLM 转换为 VoiceProfile
 * 调用方负责提供 model 和 generate 函数
 */
export function voiceMdToProfileInput(voiceMd: string): VoiceConversionInput {
  return { voiceMd }
}
