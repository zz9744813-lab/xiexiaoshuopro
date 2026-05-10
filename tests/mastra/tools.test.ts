// tests/mastra/tools.test.ts - Mastra Tools 测试
import { describe, it, expect } from 'vitest'
import { searchBible } from '@/mastra/tools/search-bible'
import { getCharacterProfile } from '@/mastra/tools/get-character-profile'
import { getRecentSummaries } from '@/mastra/tools/get-recent-summaries'
import { addIssue } from '@/mastra/tools/add-issue'
import { getWorldClockState } from '@/mastra/tools/get-world-clock'
import { getActiveVoiceCard } from '@/mastra/tools/get-voice-card'
import { getCanonFacts } from '@/mastra/tools/get-canon-facts'
import { getGenreProfile } from '@/mastra/tools/get-genre-profile'

describe('Mastra Tools 定义', () => {
  it('searchBible tool 正确定义', () => {
    expect(searchBible).toBeDefined()
    expect(searchBible.id).toBe('search-bible')
    expect(searchBible.description).toContain('bible')
  })

  it('getCharacterProfile tool 正确定义', () => {
    expect(getCharacterProfile).toBeDefined()
    expect(getCharacterProfile.id).toBe('get-character-profile')
  })

  it('getRecentSummaries tool 正确定义', () => {
    expect(getRecentSummaries).toBeDefined()
    expect(getRecentSummaries.id).toBe('get-recent-summaries')
  })

  it('addIssue tool 正确定义', () => {
    expect(addIssue).toBeDefined()
    expect(addIssue.id).toBe('add-issue')
  })

  it('getWorldClockState tool 正确定义', () => {
    expect(getWorldClockState).toBeDefined()
    expect(getWorldClockState.id).toBe('get-world-clock-state')
  })

  it('getActiveVoiceCard tool 正确定义', () => {
    expect(getActiveVoiceCard).toBeDefined()
    expect(getActiveVoiceCard.id).toBe('get-active-voice-card')
  })

  it('getCanonFacts tool 正确定义', () => {
    expect(getCanonFacts).toBeDefined()
    expect(getCanonFacts.id).toBe('get-canon-facts')
  })

  it('getGenreProfile tool 正确定义', () => {
    expect(getGenreProfile).toBeDefined()
    expect(getGenreProfile.id).toBe('get-genre-profile')
  })

  it('getGenreProfile 能读取仙侠配置', async () => {
    const result = await getGenreProfile.execute({ genre: 'xianxia' }, { toolCallId: 'test', messages: [] })
    expect(result).toBeDefined()
    expect(result.id).toBe('xianxia')
    expect(result.contract.must_have.length).toBeGreaterThan(0)
  })

  it('getGenreProfile 未知类型返回默认', async () => {
    const result = await getGenreProfile.execute({ genre: 'unknown_genre' }, { toolCallId: 'test', messages: [] })
    expect(result).toBeDefined()
    expect(result.id).toBe('unknown_genre')
    expect(result.contract.must_have).toEqual([])
  })
})
