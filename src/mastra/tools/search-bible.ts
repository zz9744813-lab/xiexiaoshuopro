// mastra/tools/search-bible.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { worldEntries } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const searchBible = createTool({
  id: 'search-bible',
  description: '在世界观 bible 中搜索相关条目',
  inputSchema: z.object({
    projectId: z.string(),
    query: z.string().describe('搜索关键词'),
    kinds: z.array(z.string()).optional().describe('条目类型过滤'),
    topK: z.number().default(5),
  }),
  execute: async ({ projectId, query, kinds, topK }) => {
    let results = await db
      .select()
      .from(worldEntries)
      .where(eq(worldEntries.projectId, projectId))

    results = results.filter(e =>
      e.name.includes(query) ||
      (e.description && e.description.includes(query))
    )

    if (kinds && kinds.length > 0) {
      results = results.filter(e => kinds.includes(e.kind))
    }

    return results.slice(0, topK).map(e => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      description: e.description,
    }))
  },
})
