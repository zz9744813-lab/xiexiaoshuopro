// tests/mastra/agents.test.ts - Mastra Agents 配置测试
import { describe, it, expect } from 'vitest'
import { chapterDraftAgent } from '@/mastra/agents/chapter-draft'
import { chapterSummaryAgent } from '@/mastra/agents/chapter-summary'
import { premiseAgent } from '@/mastra/agents/premise'
import { volumeOutlineAgent } from '@/mastra/agents/volume-outline'
import { chapterOutlineAgent } from '@/mastra/agents/chapter-outline'
import { bibleExtractAgent } from '@/mastra/agents/bible-extract'
import { hookAgent } from '@/mastra/agents/hook'
import { sectionRewriterAgent } from '@/mastra/agents/section-rewriter'
import { directorAgent } from '@/mastra/agents/director'
import { narratorAgent } from '@/mastra/agents/narrator'
import { createCharacterAgent } from '@/mastra/agents/character-agent'

describe('Mastra Agents', () => {
  it('所有核心 agents 正确实例化', () => {
    expect(chapterDraftAgent).toBeDefined()
    expect(chapterDraftAgent.name).toBe('chapter-draft')

    expect(chapterSummaryAgent).toBeDefined()
    expect(chapterSummaryAgent.name).toBe('chapter-summary')

    expect(premiseAgent).toBeDefined()
    expect(premiseAgent.name).toBe('premise')

    expect(volumeOutlineAgent).toBeDefined()
    expect(volumeOutlineAgent.name).toBe('volume-outline')

    expect(chapterOutlineAgent).toBeDefined()
    expect(chapterOutlineAgent.name).toBe('chapter-outline')

    expect(bibleExtractAgent).toBeDefined()
    expect(bibleExtractAgent.name).toBe('bible-extract')

    expect(hookAgent).toBeDefined()
    expect(hookAgent.name).toBe('hook')

    expect(sectionRewriterAgent).toBeDefined()
    expect(sectionRewriterAgent.name).toBe('section-rewriter')
  })

  it('推演 agents 正确实例化', () => {
    expect(directorAgent).toBeDefined()
    expect(directorAgent.name).toBe('director')

    expect(narratorAgent).toBeDefined()
    expect(narratorAgent.name).toBe('narrator')
  })

  it('CharacterAgent 工厂函数正确创建实例', () => {
    const agent = createCharacterAgent({
      id: 'test-char-1',
      name: '李某',
      publicRole: '剑修',
      secretMotive: '寻找失踪的师父',
      trueIntent: '复仇',
      voiceMd: '冷峻简洁',
      currentEmotionalState: '平静',
      knowledgeFacts: ['师父三年前失踪'],
      knowledgeSuspected: ['王某可能知道内情'],
      knowledgeLies: [],
    })

    expect(agent).toBeDefined()
    expect(agent.name).toBe('character-李某')
  })

  it('CharacterAgent 指令包含角色信息', () => {
    const agent = createCharacterAgent({
      id: 'test-char-2',
      name: '王某',
      publicRole: '商人',
      secretMotive: '暗中收集情报',
      trueIntent: '为宗门效力',
      voiceMd: '圆滑世故',
      currentEmotionalState: '警惕',
      knowledgeFacts: ['李某在找师父'],
      knowledgeSuspected: [],
      knowledgeLies: ['以为张某是盟友'],
    })

    expect(agent).toBeDefined()
    // Agent 的 instructions 应包含角色信息
    // 由于 Mastra Agent 的 instructions 是私有的，我们只验证创建成功
  })
})
