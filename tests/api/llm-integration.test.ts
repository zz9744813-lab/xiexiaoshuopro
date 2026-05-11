// tests/api/llm-integration.test.ts - LLM API 集成测试
// 全部 LLM 调用通过 src/lib/models.ts 获取模型，与生产代码同路径
import { describe, it, expect } from 'vitest'
import { deepseekChat } from '@/lib/models'
import { generateText } from 'ai'

describe('LLM Integration (via models.ts)', () => {
  it('generateText 基本调用', async () => {
    const result = await generateText({
      model: deepseekChat(),
      prompt: '回复"测试成功"四个字，不要输出其他内容',
      maxTokens: 50,
      temperature: 0.1,
    })

    expect(result.text).toContain('测试成功')
  })

  it('小说生成能力测试', async () => {
    const result = await generateText({
      model: deepseekChat(),
      system: '你是一位小说作者。直接输出小说正文，不要前置说明。',
      prompt: '写一段50字左右的仙侠小说开头，主角站在悬崖边。',
      maxTokens: 300,
      temperature: 0.85,
    })

    expect(result.text.length).toBeGreaterThan(20)
    expect(result.text).not.toMatch(/^(好的|当然|以下是)/)
  })

  it('JSON 结构化输出测试', async () => {
    const result = await generateText({
      model: deepseekChat(),
      prompt: '输出一个JSON对象，包含name和age字段，name为"李某"，age为25。只输出JSON，不要其他内容。',
      maxTokens: 200,
      temperature: 0.1,
    })

    const text = result.text.trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    expect(jsonMatch).toBeTruthy()
    const parsed = JSON.parse(jsonMatch![0])
    expect(parsed.name).toBe('李某')
    expect(parsed.age).toBe(25)
  })

  it('Token 用量统计正确', async () => {
    const result = await generateText({
      model: deepseekChat(),
      prompt: '说你好',
      maxTokens: 50,
    })

    expect(result.usage).toBeDefined()
    expect(result.usage.promptTokens).toBeGreaterThan(0)
    expect(result.usage.completionTokens).toBeGreaterThan(0)
    expect(result.usage.totalTokens).toBe(
      result.usage.promptTokens + result.usage.completionTokens
    )
  })
})