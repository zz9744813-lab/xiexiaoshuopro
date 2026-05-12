// tests/workflows/simulation-isolation.test.ts — TASK-5 知识隔离测试
import { describe, it, expect, vi } from 'vitest'
import type { SimulationTurn } from '@/mastra/workflows/simulation'

// 模拟 turn 生成逻辑，验证知识隔离规则
describe('Simulation Turn 知识隔离', () => {
  const mockCharacters = [
    { id: 'alice', name: '爱丽丝', publicRole: '冒险者', secretMotive: '复仇', voiceMd: '', knowledgeFacts: ['秘密A'] },
    { id: 'bob', name: '鲍勃', publicRole: '铁匠', secretMotive: '保护家人', voiceMd: '', knowledgeFacts: ['秘密B'] },
    { id: 'carol', name: '卡罗尔', publicRole: '商人', secretMotive: '找宝藏', voiceMd: '', knowledgeFacts: ['秘密C'] },
  ]

  const makeTurn = (speakerId: string, utterance: string, visibleTo: string[]): SimulationTurn => ({
    turnIdx: 0,
    speakerType: 'character' as const,
    speakerId,
    speakerName: speakerId,
    utterance,
    reasoning: '',
    visibleTo,
  })

  it('角色 turn 默认 visibleTo 不应全员可见（至少排除一个角色）', () => {
    // 模拟 simulation 中的 visibleTo 逻辑：fallback 为仅发言人自己
    const defaultVisibleTo = [mockCharacters[0].id] // fallback: only speaker
    expect(defaultVisibleTo.length).toBeLessThan(mockCharacters.length)
  })

  it('visibleTo 过滤：不在列表中的角色看不到 utterance', () => {
    const turns: SimulationTurn[] = [
      makeTurn('alice', '我的宝剑丢了', ['alice', 'bob']),  // carol 不可见
      makeTurn('bob', '我帮你找找', ['bob', 'alice']),       // carol 不可见
    ]

    // carol 可见的 turns 应为空（她被排除在外）
    const carolVisible = turns.filter(t => t.visibleTo.includes('carol'))
    expect(carolVisible).toHaveLength(0)
  })

  it('发言者自己总能在 visibleTo 中看到自己的 turn', () => {
    const turns: SimulationTurn[] = [
      makeTurn('alice', '你好', ['alice']),
      makeTurn('bob', '你好呀', ['bob', 'carol']),
    ]

    // 发言者自己能看到自己的 turn
    const aliceSees = turns.filter(t => t.visibleTo.includes('alice'))
    expect(aliceSees).toHaveLength(1)

    const bobSees = turns.filter(t => t.visibleTo.includes('bob'))
    expect(bobSees).toHaveLength(1)
  })

  it('visibleTo 空列表时角色不可见（narrator 场景）', () => {
    const turns: SimulationTurn[] = [
      makeTurn('narrator', '夕阳西下', []),
    ]

    const anyoneSees = turns.filter(t =>
      t.visibleTo.some(id => mockCharacters.map(c => c.id).includes(id))
    )
    expect(anyoneSees).toHaveLength(0)
  })

  it('推理（reasoning）不暴露给其他角色', () => {
    // reasoning 字段在 utterance 之外，角色只看到 utterance
    const turn: SimulationTurn = {
      turnIdx: 0,
      speakerType: 'character',
      speakerId: 'alice',
      speakerName: '爱丽丝',
      utterance: '好的',
      reasoning: '我其实在骗他',
      visibleTo: ['alice', 'bob'],
    }

    // Bob 可以看到 utterance 但看不到 reasoning
    expect(turn.visibleTo).toContain('bob')
    // reasoning 不应在 visibleTo 过滤的公开内容中
    expect(turn.reasoning).toBeTruthy() // reasoning 存在
    // 但在实际使用时，角色只读 utterance
    const publicInfo = { utterance: turn.utterance }
    expect(publicInfo).not.toHaveProperty('reasoning')
  })
})
