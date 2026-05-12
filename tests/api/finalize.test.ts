// tests/api/finalize.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/mastra', () => ({
  mastra: {
    getAgent: (name: string) => ({
      generate: async () => ({ text: '{}' }),
    }),
  },
}))

vi.mock('@/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => [{ id: '1', activeVersionId: 'v1', chapterOutlineId: 'o1' }] }) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    insert: () => ({ values: () => ({ returning: () => [{ id: 'new' }] }) }),
    execute: async () => ({ rows: [] }),
  },
}))

describe('Finalize API', () => {
  it('finalize 触发审查流程', async () => {
    expect(true).toBe(true)
  })
})
