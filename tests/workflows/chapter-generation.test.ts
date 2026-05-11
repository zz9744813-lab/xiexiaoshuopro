// tests/workflows/chapter-generation.test.ts - 章节生成 Workflow 端到端测试
import { describe, it, expect, beforeAll } from 'vitest'
import { runChapterGeneration } from '@/mastra/workflows/chapter-generation'

import { getModelForTask } from '@/lib/models'
import { generateText } from 'ai'

describe('Chapter Generation Workflow', () => {
  let apiAvailable = false

  beforeAll(async () => {
    // 检查 API 是否可用
    try {
      const { model } = getModelForTask('draft')
      const { text } = await generateText({
        model,
        messages: [{ role: 'user', content: 'hi' }],
        maxTokens: 5,
      })
      apiAvailable = !!text
    } catch {
      apiAvailable = false
    }
  })

  it('完整章节生成流水线', async () => {
    if (!apiAvailable) { console.log('API 不可用，跳过'); return }

    const result = await runChapterGeneration({
      chapterId: 'test-ch-1',
      projectId: 'test-proj-1',
      outline: '主角李某站在悬崖边，回忆起师父的教诲。远处传来追兵的脚步声。他必须做出选择：跳下去赌一条生路，还是转身面对。',
      genre: '仙侠',
      voiceCard: '冷峻简洁，短句为主，避免华丽辞藻',
    })

    // 验证生成了内容
    expect(result.content).toBeDefined()
    expect(result.content.length).toBeGreaterThan(100)
    expect(result.wordCount).toBeGreaterThan(100)

    // 验证文风指纹
    expect(result.fingerprint).toBeDefined()
    expect(result.fingerprint.avgSentenceLength).toBeGreaterThan(0)
    expect(result.fingerprint.paragraphCount).toBeGreaterThan(0)

    // 验证 slop 检测运行了
    expect(result.slopHits).toBeGreaterThanOrEqual(0)

    console.log(`生成字数: ${result.wordCount}`)
    console.log(`AI味命中: ${result.slopHits}`)
    console.log(`平均句长: ${result.fingerprint.avgSentenceLength}`)
  }, 60000) // 60s timeout for LLM call
})
