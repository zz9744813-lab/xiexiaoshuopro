// tests/lib/models.test.ts - LLM Provider 测试
import { describe, it, expect } from 'vitest'
import { deepseekChat, deepseekReasoner, getModelForTask } from '@/lib/models'

describe('LLM Models', () => {
  it('deepseekChat 返回有效模型实例', () => {
    const model = deepseekChat()
    expect(model).toBeDefined()
    // modelId 由环境变量决定，不硬编码断言
    expect(model.modelId).toBeTruthy()
  })

  it('deepseekReasoner 返回有效模型实例', () => {
    const model = deepseekReasoner()
    expect(model).toBeDefined()
    expect(model.modelId).toBeTruthy()
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

  it('getModelForTask 所有 task 类型都有配置', () => {
    const tasks = ['draft', 'outline', 'review', 'summary', 'simulation', 'rewrite', 'extract'] as const
    for (const task of tasks) {
      const config = getModelForTask(task)
      expect(config.model).toBeDefined()
      expect(config.temperature).toBeGreaterThan(0)
      expect(config.maxTokens).toBeGreaterThan(0)
    }
  })
})
