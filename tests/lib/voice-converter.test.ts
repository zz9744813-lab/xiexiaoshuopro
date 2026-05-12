// tests/lib/voice-converter.test.ts — TASK-6 Voice MD → JSON 转换测试
import { describe, it, expect } from 'vitest'
import { voiceToPromptText } from '@/lib/voice-converter'
import type { VoiceProfile } from '@/types/voice'

const mockProfile: VoiceProfile = {
  tone: '冷静',
  style: '简洁',
  sentencePatterns: {
    sentenceLength: 'short',
    preferredOpeners: ['嗯…', '听我说，'],
    preferredEndings: ['不是吗？'],
  },
  vocabulary: {
    signaturePhrases: ['有趣', '无聊'],
    avoidedWords: ['死', '杀'],
    register: '现代',
  },
  mannerisms: {
    actionCues: ['推了推眼镜', '叹气'],
    emotionalExpressiveness: 'subtle',
  },
}

describe('voiceToPromptText', () => {
  it('VoiceProfile → 结构化 prompt 文本', () => {
    const result = voiceToPromptText('ignored md', mockProfile)
    expect(result).toContain('语气基调')
    expect(result).toContain('冷静')
    expect(result).toContain('简洁')
    expect(result).toContain('口头禅')
    expect(result).toContain('有趣')
    expect(result).toContain('内敛')
  })

  it('无 voiceProfile 时 fallback 到 raw voiceMd', () => {
    const result = voiceToPromptText('冷酷无情，话少', undefined)
    expect(result).toBe('冷酷无情，话少')
  })

  it('空 voiceMd fallback 返回默认值', () => {
    const result = voiceToPromptText('', undefined)
    expect(result).toBe('自然说话')
  })

  it('VoiceProfile 可选字段缺失不报错', () => {
    const minimal: VoiceProfile = { tone: '活泼', style: '直白', sentencePatterns: {}, vocabulary: {}, mannerisms: {} }
    const result = voiceToPromptText('', minimal)
    expect(result).toContain('活泼')
    expect(result).not.toContain('undefined')
    expect(result).not.toContain('null')
  })

  it('rawNotes 补充描述包含在输出中', () => {
    const withNotes: VoiceProfile = {
      ...mockProfile,
      rawNotes: '喝醉时会说胡话',
    }
    const result = voiceToPromptText('', withNotes)
    expect(result).toContain('喝醉时会说胡话')
  })

  it('voiceProfile 优先级高于 voiceMd', () => {
    const result = voiceToPromptText('这是旧版 voiceMd', mockProfile)
    expect(result).toContain('语气基调')
    expect(result).not.toContain('这是旧版 voiceMd')
  })
})
