// tests/workflows/simulation-isolation.test.ts
import { describe, it, expect, vi } from 'vitest'
import { runSimulationWorkflow } from '@/mastra/workflows/simulation'

const calls: { agentName: string; prompt: string }[] = []
vi.mock('@/mastra', () => ({
  mastra: {
    getAgent: (name: string) => ({
      generate: async ({ messages }: any) => {
        calls.push({ agentName: name, prompt: messages[0].content })
        if (name === 'director') {
          return { text: JSON.stringify({
            action: 'speak',
            targetName: 'A',
            visibleTo: ['a'],
          }) }
        }
        return { text: JSON.stringify({
          utterance: 'hi',
          reasoning: 'A的内心戏不能让B看到'
        }) }
      },
    }),
  },
}))

describe('Simulation knowledge isolation', () => {
  it('B 的 prompt 里不能出现 A 的 reasoning', async () => {
    calls.length = 0
    await runSimulationWorkflow({
      projectId: 'p1',
      directorGoal: 'test',
      characters: [
        { id: 'a', name: 'A', publicRole: '', secretMotive: '', voiceMd: '', knowledgeFacts: [] },
        { id: 'b', name: 'B', publicRole: '', secretMotive: '', voiceMd: '', knowledgeFacts: [] },
      ],
      maxTurns: 4,
    })

    const bCalls = calls.filter(c => c.prompt.includes('character_name: B'))
    for (const c of bCalls) {
      expect(c.prompt).not.toContain('A的内心戏')
    }
  })
})
