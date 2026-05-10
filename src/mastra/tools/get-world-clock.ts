// mastra/tools/get-world-clock.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { worldClock, betweenChapterEvents } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const getWorldClockState = createTool({
  id: 'get-world-clock-state',
  description: '获取当前世界时钟状态和未处理的章间事件',
  inputSchema: z.object({
    projectId: z.string(),
  }),
  execute: async ({ projectId }) => {
    const [clock] = await db
      .select()
      .from(worldClock)
      .where(eq(worldClock.projectId, projectId))

    const events = await db
      .select()
      .from(betweenChapterEvents)
      .where(eq(betweenChapterEvents.projectId, projectId))

    const unacknowledged = events.filter(e => !e.acknowledgedByUser)

    return {
      currentWorldDate: clock?.currentWorldDate || '未设定',
      paceConfig: clock?.paceConfig,
      pendingEvents: unacknowledged.map(e => ({
        id: e.id,
        eventText: e.eventText,
        visibility: e.visibility,
      })),
    }
  },
})
