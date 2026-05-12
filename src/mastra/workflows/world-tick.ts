// mastra/workflows/world-tick.ts - 世界演化 Workflow
// 在章节之间推进世界状态：背景事件、NPC 活动、世界时钟
import { mastra } from '@/mastra'

export interface WorldTickInput {
  projectId: string
  chapterId: string
  inWorldTimeDelta?: string
  chapterSummary?: string
}

export interface WorldEvent {
  type: 'political' | 'environmental' | 'npc_action' | 'rumor' | 'discovery' | 'economy'
  description: string
  location?: string
  affectedCharacters?: string[]
  importance: number
  visibleToReader: boolean
}

export interface WorldTickResult {
  events: WorldEvent[]
  worldStateUpdates: Record<string, unknown>
  betweenChapterSummary: string
}

export async function runWorldTick(input: WorldTickInput): Promise<WorldTickResult> {
  const agent = mastra.getAgent('director')

  const prompt = [
    `project_id: ${input.projectId}`,
    `chapter_id: ${input.chapterId}`,
    `in_world_time_delta: ${input.inWorldTimeDelta || '1 day'}`,
    `chapter_summary: ${input.chapterSummary || '无'}`,
    '',
    '请推进世界状态。考虑：',
    '1. 政治/社会环境是否发生了变化？',
    '2. 重要 NPC 在这段时间做了什么？',
    '3. 环境或天气是否有值得注意的变化？',
    '4. 是否有新的谣言或消息在传播？',
    '5. 经济/资源配置是否有变化？',
    '',
    '输出 JSON: { "events": [...], "worldStateUpdates": {...}, "betweenChapterSummary": "..." }',
  ].join('\n')

  const result = await agent.generate({
    messages: [{ role: 'user', content: prompt }],
    runtimeContext: { projectId: input.projectId, chapterId: input.chapterId },
  })

  try {
    return JSON.parse(result.text)
  } catch {
    return {
      events: [],
      worldStateUpdates: {},
      betweenChapterSummary: result.text.slice(0, 500),
    }
  }
}
