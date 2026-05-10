// tests/api/llm-integration.test.ts - LLM API 集成测试
// 需要有效的 API key 和余额才能通过
import { describe, it, expect, beforeAll } from 'vitest'

const API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-xbimfoljodzimecrnxcovyglztapkuffddcyjvbujkslghmb'
const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.siliconflow.cn/v1'

describe('LLM Integration (SiliconFlow)', () => {
  let isAvailable = false

  beforeAll(async () => {
    // 检查 API 是否可用
    try {
      const res = await fetch(`${BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      })
      isAvailable = res.ok
    } catch {
      isAvailable = false
    }
  })

  it('API 连接正常', async () => {
    const res = await fetch(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data).toBeDefined()
    expect(Array.isArray(data.data)).toBe(true)
    expect(data.data.length).toBeGreaterThan(0)
  })

  it('Chat Completion 基本调用', async () => {
    if (!isAvailable) return

    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-V3',
        messages: [{ role: 'user', content: '回复"测试成功"四个字' }],
        max_tokens: 20,
        temperature: 0.1,
      }),
    })

    const data = await res.json()

    if (data.code === 30001) {
      // 余额不足，跳过但不失败
      console.log('API 余额不足，跳过生成测试')
      return
    }

    expect(res.status).toBe(200)
    expect(data.choices).toBeDefined()
    expect(data.choices[0].message.content).toContain('测试成功')
  })

  it('流式输出测试', async () => {
    if (!isAvailable) return

    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-V3',
        messages: [{ role: 'user', content: '数到5' }],
        max_tokens: 50,
        stream: true,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      if (err.code === 30001) {
        console.log('API 余额不足，跳过流式测试')
        return
      }
    }

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')

    // 读取部分流
    const reader = res.body?.getReader()
    if (reader) {
      const { value } = await reader.read()
      expect(value).toBeDefined()
      reader.cancel()
    }
  })

  it('模型列表包含 DeepSeek', async () => {
    const res = await fetch(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    })
    const data = await res.json()
    const modelIds = data.data.map((m: { id: string }) => m.id)
    const hasDeepSeek = modelIds.some((id: string) => id.toLowerCase().includes('deepseek'))
    expect(hasDeepSeek).toBe(true)
  })
})
