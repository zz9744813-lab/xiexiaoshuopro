// tests/lib/style-fingerprint.test.ts - 文风指纹测试
import { describe, it, expect } from 'vitest'
import { computeStyleFingerprint, detectDrift } from '@/lib/style-fingerprint'

describe('StyleFingerprint', () => {
  it('计算基本指标', () => {
    const text = '他走进房间。窗外下着雨。桌上放着一杯茶。\n\n她抬头看了他一眼。没有说话。'
    const fp = computeStyleFingerprint(text)

    expect(fp.avgSentenceLength).toBeGreaterThan(0)
    expect(fp.sentenceLengthVariance).toBeGreaterThanOrEqual(0)
    expect(fp.vocabRichness).toBeGreaterThan(0)
    expect(fp.vocabRichness).toBeLessThanOrEqual(1)
    expect(fp.paragraphCount).toBe(2)
    expect(fp.wordCount).toBe(text.length)
  })

  it('对话比例计算', () => {
    const textWithDialogue = '"你好。"他说。"你也好。"她回答。其他叙述内容在这里。'
    const fp = computeStyleFingerprint(textWithDialogue)
    expect(fp.dialogueRatio).toBeGreaterThan(0)
    expect(fp.dialogueRatio).toBeLessThan(1)
  })

  it('无对话文本对话比例为 0', () => {
    const text = '他走在路上。天色渐暗。远处传来钟声。'
    const fp = computeStyleFingerprint(text)
    expect(fp.dialogueRatio).toBe(0)
  })

  it('重复短语检测', () => {
    const text = '他看着她。他看着她。他看着她。他看着她。然后转身离开。'
    const fp = computeStyleFingerprint(text)
    expect(fp.repeatedPhrases.length).toBeGreaterThan(0)
    expect(fp.repeatedPhrases[0].count).toBeGreaterThanOrEqual(3)
  })

  it('空文本处理', () => {
    const fp = computeStyleFingerprint('')
    expect(fp.avgSentenceLength).toBe(0)
    expect(fp.vocabRichness).toBe(0)
    expect(fp.dialogueRatio).toBe(0)
    expect(fp.wordCount).toBe(0)
  })

  it('漂移检测 - 无漂移', () => {
    const baseline = computeStyleFingerprint('短句。短句。短句。短句。短句。')
    const current = computeStyleFingerprint('短句。短句。短句。短句。短句。')
    const drifts = detectDrift(current, baseline)
    expect(drifts.length).toBe(0)
  })

  it('漂移检测 - 句长漂移', () => {
    const baseline = computeStyleFingerprint('短。短。短。短。短。')
    const current = computeStyleFingerprint('这是一个非常非常非常长的句子用来测试漂移检测功能是否正常工作。这也是一个很长的句子。')
    const drifts = detectDrift(current, baseline)
    expect(drifts.some(d => d.axis === 'avg_sentence_length')).toBe(true)
  })
})
