// tests/mastra/reviewers.test.ts - Reviewer Agents 测试
import { describe, it, expect } from 'vitest'
import {
  logicReviewer,
  voiceReviewer,
  canonReviewer,
  pacingReviewer,
  themeReviewer,
  genreReviewer,
  readerSimulator,
  slopReviewer,
} from '@/mastra/agents/reviewers'

describe('Reviewer Agents', () => {
  const reviewers = [
    { agent: logicReviewer, name: 'logic-reviewer' },
    { agent: voiceReviewer, name: 'voice-reviewer' },
    { agent: canonReviewer, name: 'canon-reviewer' },
    { agent: pacingReviewer, name: 'pacing-reviewer' },
    { agent: themeReviewer, name: 'theme-reviewer' },
    { agent: genreReviewer, name: 'genre-reviewer' },
    { agent: readerSimulator, name: 'reader-simulator' },
    { agent: slopReviewer, name: 'slop-reviewer' },
  ]

  it('所有 8 个 reviewer 正确实例化', () => {
    expect(reviewers.length).toBe(8)
    for (const { agent, name } of reviewers) {
      expect(agent).toBeDefined()
      expect(agent.name).toBe(name)
    }
  })

  it('每个 reviewer 有唯一 ID', () => {
    const ids = reviewers.map(r => r.agent.name)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })
})
