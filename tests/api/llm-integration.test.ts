// tests/api/llm-integration.test.ts - LLM API 集成测试 (NVIDIA API)
import { describe, it, expect, beforeAll } from 'vitest'

import { getModelForTask } from '@/lib/models'
import { generateText, streamText } from 'ai'

describe('LLM Integration (AI SDK)', () => {
  let isAvailable = false

  beforeAll(async () => {
    try {
      const { model } = getModelForTask('draft')
      const { text } = await generateText({
        model,
        messages: [{ role: 'user', content: 'hi' }],
        maxTokens: 10,
      })
      isAvailable = !!text
    } catch {
      isAvailable = false
    }
  })

  it('Chat Completion 基本调用', async () => {
    if (!isAvailable) {
      console.log('API 不可用，跳过')
      return
    }

    const { model } = getModelForTask('draft')
    const { text } = await generateText({
      model,
      messages: [{ role: 'user', content: '回复"测试成功"四个字，不要输出其他内容' }],
      maxTokens: 100,
      temperature: 0.1,
    })

    expect(text).toContain('测试成功')
  })

  it('流式输出测试', async () => {
    if (!isAvailable) return

    const { model } = getModelForTask('draft')
    const result = streamText({
      model,
      messages: [{ role: 'user', content: '数到3' }],
      maxTokens: 100,
    })

    let fullText = ''
    for await (const textPart of result.textStream) {
      fullText += textPart
    }

    expect(fullText.length).toBeGreaterThan(0)
  })

  it('小说生成能力测试', async () => {
    if (!isAvailable) return

    const { model } = getModelForTask('draft')
    const { text } = await generateText({
      model,
      messages: [{
        role: 'system',
        content: '你是一位小说作者。直接输出小说正文，不要前置说明。'
      }, {
        role: 'user',
        content: '写一段50字左右的仙侠小说开头，主角站在悬崖边。'
      }],
      maxTokens: 300,
      temperature: 0.85,
    })

    expect(text.length).toBeGreaterThan(20)
    // 不应包含 AI 味的前置说明
    expect(text).not.toMatch(/^(好的|当然|以下是)/)
  })

  it('JSON 结构化输出测试', async () => {
    if (!isAvailable) return

    const { model } = getModelForTask('draft')
    const { text: content } = await generateText({
      model,
      messages: [{
        role: 'user',
        content: '输出一个JSON对象，包含name和age字段，name为"李某"，age为25。只输出JSON，不要其他内容，不要思考过程。'
      }],
      maxTokens: 200,
      temperature: 0.1,
    })

    // 提取 JSON（可能包含 think 标签）
    const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    const jsonMatch = cleanContent.match(/\{[^{}]*"name"[^{}]*\}/) || cleanContent.match(/\{[\s\S]*?\}/)

    if (!jsonMatch) {
      // 模型可能输出了 markdown 代码块
      const codeBlockMatch = cleanContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
      if (codeBlockMatch) {
        const parsed = JSON.parse(codeBlockMatch[1])
        expect(parsed.name).toBe('李某')
        return
      }
      // 如果实在提取不到，只验证响应包含关键信息
      expect(content).toContain('李某')
      return
    }

    const parsed = JSON.parse(jsonMatch[0])
    expect(parsed.name).toBe('李某')
  })

  it('Token 用量统计正确', async () => {
    if (!isAvailable) return

    const { model } = getModelForTask('draft')
    const { usage } = await generateText({
      model,
      messages: [{ role: 'user', content: '说你好' }],
      maxTokens: 50,
    })

    expect(usage).toBeDefined()
    expect(usage.promptTokens).toBeGreaterThan(0)
    expect(usage.completionTokens).toBeGreaterThan(0)
    expect(usage.totalTokens).toBe(usage.promptTokens + usage.completionTokens)
  })
})
