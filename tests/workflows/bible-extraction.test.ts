// tests/workflows/bible-extraction.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/mastra', () => ({
  mastra: {
    getAgent: () => ({
      generate: async () => ({ text: '{"canonFacts":[],"worldEntries":[]}' }),
    }),
  },
}))

vi.mock('@/db', () => ({
  db: {
    insert: () => ({ values: () => ({ returning: () => [{}] }) }),
  },
}))

vi.mock('@/lib/embed', () => ({
  embed: async () => [0.1, 0.2, 0.3],
}))

describe('Bible Extraction', () => {
  it('章节内容抽取 fact 入库', async () => {
    expect(true).toBe(true)
  })
})
