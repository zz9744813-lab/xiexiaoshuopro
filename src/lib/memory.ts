// src/lib/memory.ts
import { Memory } from '@mastra/memory'
import { PostgresStore, PgVector } from '@mastra/pg'
import { embed } from './embed'

const storage = new PostgresStore({
  connectionString: process.env.DATABASE_URL!,
})

const vectorStore = new PgVector({
  connectionString: process.env.DATABASE_URL!,
})

export const sharedMemory = new Memory({
  options: {
    lastMessages: 50,
    semanticRecall: {
      topK: 5,
      messageRange: { before: 4, after: 2 },
    },
    threads: { generateTitle: true },
  },
  storage,
  vector: vectorStore,
  embedder: {
    provider: 'custom',
    customConfig: {
      embed: async (texts: string[]) => {
        const results = await Promise.all(texts.map(t => embed(t).catch(() => null)))
        return results.filter(Boolean) as number[][]
      },
    },
  },
})

export function createAgentMemory(agentId: string) {
  return sharedMemory
}

export function characterThreadId(projectId: string, characterId: string) {
  return `${projectId}:char:${characterId}`
}

export function characterResourceId(characterId: string) {
  return `character:${characterId}`
}
