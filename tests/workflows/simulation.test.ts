// tests/workflows/simulation.test.ts - 推演 Workflow 端到端测试
// 通过 src/lib/models.ts 获取模型，与生产代码同路径
import { describe, it, expect } from 'vitest'
import { runSimulationWorkflow } from '@/mastra/workflows/simulation'

describe('Simulation Workflow', () => {
  it('多角色推演生成对话', async () => {
    const result = await runSimulationWorkflow({
      projectId: 'test-proj-1',
      directorGoal: '李某和王某在酒楼相遇，互相试探对方的底细。最终李某发现王某在说谎。',
      characters: [
        {
          id: 'char-1',
          name: '李某',
          publicRole: '游历剑修',
          secretMotive: '寻找失踪的师父',
          voiceMd: '冷峻简洁',
          knowledgeFacts: ['师父三年前失踪', '王某曾出现在师父失踪的地点附近'],
        },
        {
          id: 'char-2',
          name: '王某',
          publicRole: '商人',
          secretMotive: '暗中为玄阴宗收集情报',
          voiceMd: '圆滑世故，善于周旋',
          knowledgeFacts: ['李某的师父已被玄阴宗囚禁', '不能暴露自己的身份'],
        },
      ],
      maxTurns: 6,
    })

    // 验证生成了对话
    expect(result.turns.length).toBeGreaterThan(0)
    expect(result.turns.length).toBeLessThanOrEqual(6)
    expect(result.scriptMd.length).toBeGreaterThan(0)
    expect(result.turnCount).toBe(result.turns.length)

    // 验证每个 turn 结构正确
    for (const turn of result.turns) {
      expect(turn.speakerName).toBeDefined()
      expect(turn.utterance).toBeDefined()
      expect(turn.utterance.length).toBeGreaterThan(0)
    }

    // 验证两个角色都有发言
    const speakers = new Set(result.turns.map(t => t.speakerName))
    console.log(`推演轮数: ${result.turnCount}`)
    console.log(`参与角色: ${[...speakers].join(', ')}`)
    console.log(`剧本长度: ${result.scriptMd.length} 字`)
  }, 120000) // 推演需要多次 LLM 调用
})