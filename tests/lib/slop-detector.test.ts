// tests/lib/slop-detector.test.ts - AI 味检测测试
import { describe, it, expect } from 'vitest'
import { detectSlop, slopRate } from '@/lib/slop-detector'

describe('SlopDetector', () => {
  it('检测基本 AI 味词汇', () => {
    const text = '他不禁心中一动，眼中闪烁着复杂的情绪。'
    const hits = detectSlop(text)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.some(h => h.pattern === '不禁')).toBe(true)
    expect(hits.some(h => h.pattern === '眼中闪烁着')).toBe(true)
  })

  it('检测多个命中', () => {
    const text = '她不由自主地深吸一口气，嘴角微微上扬，心头一紧。'
    const hits = detectSlop(text)
    expect(hits.length).toBeGreaterThanOrEqual(3)
  })

  it('无 AI 味文本返回空', () => {
    const text = '他站在门口，看着远处的山。风吹过来，带着泥土的气味。'
    const hits = detectSlop(text)
    expect(hits.length).toBe(0)
  })

  it('正则模式检测', () => {
    const text = '她的笑容仿佛春风一般温暖。'
    const hits = detectSlop(text)
    expect(hits.some(h => h.category === 'cliche')).toBe(true)
  })

  it('slopRate 计算正确', () => {
    const cleanText = '他走进房间，坐下来。窗外下着雨。'
    expect(slopRate(cleanText)).toBe(0)

    const slopText = '他不禁心中一动。'
    expect(slopRate(slopText)).toBeGreaterThan(0)
  })

  it('返回正确的上下文', () => {
    const text = '很长的前文内容在这里。他不禁感到一阵寒意。后面还有很多内容。'
    const hits = detectSlop(text)
    const hit = hits.find(h => h.pattern === '不禁')
    expect(hit).toBeDefined()
    expect(hit!.context).toContain('不禁')
    expect(hit!.position).toBeGreaterThan(0)
  })
})
