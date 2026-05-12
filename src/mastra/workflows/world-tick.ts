// mastra/workflows/world-tick.ts — 世界推进 Workflow
import { mastra } from '@/mastra'
import { db } from '@/db'
import { worldEntries } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

export interface WorldTickInput {
  projectId: string
  timeElapsed: string       // "3 months", "1 week", etc.
  chapterEvents: string[]   // key events that happened in the chapter
  characterDecisions: Array<{ characterId: string; name: string; decision: string }>
}

export interface WorldTickResult {
  worldUpdates: Array<{
    category: string        // "politics", "economy", "social", "environment"
    description: string
    affectedLocations: string[]
    ripples: string[]
  }>
  newFacts: string[]
  timelineEntry: string
}

/**
 * World Tick Workflow — 根据章节进展推进世界状态
 * 每次章节完成后调用，更新世界设定、生成涟漪效应
 */
export async function runWorldTick(input: WorldTickInput): Promise<WorldTickResult> {
  const agent = mastra.getAgent('director')

  const prompt = [
    `## 世界推进请求`,
    `time_elapsed: ${input.timeElapsed}`,
    `events: ${input.chapterEvents.join('; ')}`,
    `character_decisions: ${input.characterDecisions.map(d => `${d.name}: ${d.decision}`).join('; ')}`,
    ``,
    `请生成以下内容：`,
    `1. world_updates: 按类别列出的世界变化`,
    `2. new_facts: 新确立的 canon facts`,
    `3. timeline_entry: 时间线条目`,
  ].join('\n')

  const result = await agent.generate(prompt)

  try {
    const parsed = JSON.parse(result.text)
    return {
      worldUpdates: parsed.world_updates || [],
      newFacts: parsed.new_facts || [],
      timelineEntry: parsed.timeline_entry || '',
    }
  } catch {
    return { worldUpdates: [], newFacts: [], timelineEntry: '' }
  }
}
