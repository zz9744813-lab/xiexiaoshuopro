// tests/lib/models.test.ts - LLM Provider 测试
import { describe, it, expect } from 'vitest'
import { deepseekChat, deepseekReasoner, qwenMax, getModelForTask } from '@/lib/models'

describe('LLM Models', () => {
  it('deepseekChat 返回有效模型实例', () => {
    const model = deepseekChat()
    expect(model).toBeDefined()
    expect(model.modelId).toBe('deepseek-ai/DeepSeek-V3')
  })

  it('deepseekReasoner 返回有效模型实例', () => {
    const model = deepseekReasoner()
    expect(model).toBeDefined()
    expect(model.modelId).toBe('deepseek-ai/DeepSeek-R1')
  })

  it('getModelForTask 返回正确的配置', () => {
    const draftConfig = getModelForTask('draft')
    expect(draftConfig.temperature).toBe(0.85)
    expect(draftConfig.maxTokens).toBe(12000)
    expect(draftConfig.model).toBeDefined()

    const reviewConfig = getModelForTask('review')
    expect(reviewConfig.temperature).toBe(0.3)
    expect(reviewConfig.maxTokens).toBe(3000)

    const summaryConfig = getModelForTask('summary')
    expect(summaryConfig.temperature).toBe(0.5)
    expect(summaryConfig.maxTokens).toBe(2000)
  })

  it('getModelForTask unrestricted 模式 fallback', () => {
    // 没有设置 SELF_HOSTED_QWEN_URL 和 OPENROUTER_API_KEY 时应 fallback 到默认
    const config = getModelForTask('draft', 'unrestricted')
    expect(config.model).toBeDefined()
    expect(config.temperature).toBeGreaterThan(0)
  })
})
