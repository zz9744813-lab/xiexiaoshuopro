// tests/workflows/review.test.ts - 审查 Workflow 端到端测试
import { describe, it, expect } from 'vitest'
import { runReviewWorkflow } from '@/mastra/workflows/review'

describe('Review Workflow', () => {
  it('检测 AI 味文本', async () => {
    const result = await runReviewWorkflow({
      content: '他不禁心中一动，眼中闪烁着复杂的情绪。她的嘴角微微上扬，仿佛春风一般温暖。他不由自主地深吸一口气，浑身一震。',
      projectId: 'test-proj-1',
      chapterId: 'test-ch-1',
    })

    expect(result.slopHits).toBeGreaterThan(0)
    expect(result.issues.length).toBeGreaterThan(0)
    expect(result.issues.some(i => i.axis === 'aislop')).toBe(true)
    expect(result.reviewersRun).toContain('slop-detector')
  })

  it('干净文本通过检测', async () => {
    const result = await runReviewWorkflow({
      content: '他站在门口。风从窗户吹进来，吹动了桌上的纸。她没有说话，只是看着他。过了很久，她转身走了。',
      projectId: 'test-proj-1',
      chapterId: 'test-ch-2',
    })

    expect(result.slopHits).toBe(0)
    // 本地 slop 检测无命中
    const slopIssues = result.issues.filter(i => i.axis === 'aislop')
    expect(slopIssues.length).toBe(0)
  })

  it('LLM 审查运行', async () => {
    const result = await runReviewWorkflow({
      content: '李某拔出了他的激光枪，对着飞来的剑气开了一枪。修仙界从来没有出现过这种武器。',
      projectId: 'test-proj-1',
      chapterId: 'test-ch-3',
      genre: '仙侠',
      canonFacts: ['这是一个纯粹的修仙世界，没有现代科技'],
    })

    expect(result.reviewersRun.length).toBeGreaterThanOrEqual(1)
    // LLM 应该检测到设定矛盾（如果 API 可用）
    console.log('LLM 审查 issues:', result.issues.filter(i => i.axis !== 'aislop').length)
  }, 30000)
})
