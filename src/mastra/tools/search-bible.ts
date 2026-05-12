// src/mastra/tools/search-bible.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { embed } from '@/lib/embed'

export const searchBible = createTool({
  id: 'search-bible',
  description: '在世界观 bible 中按语义搜索相关条目',
  inputSchema: z.object({
    projectId: z.string(),
    query: z.string(),
    kinds: z.array(z.string()).optional(),
    topK: z.number().default(5),
  }),
  execute: async ({ projectId, query, kinds, topK }) => {
    const q = await embed(query)
    const qLit = `[${q.join(',')}]`

    const rows = await db.execute(sql`
      SELECT id, name, kind, description,
             1 - (embedding <=> ${qLit}::vector) AS similarity
      FROM world_entries
      WHERE project_id = ${projectId}
        AND embedding IS NOT NULL
        ${kinds && kinds.length > 0 ? sql`AND kind = ANY(${kinds})` : sql``}
      ORDER BY embedding <=> ${qLit}::vector
      LIMIT ${topK}
    `)
    return rows.rows
  },
})
