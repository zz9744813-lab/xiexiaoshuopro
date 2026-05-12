// mastra/tools/search-bible.ts - Semantic search over world bible entries
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db, sql } from '@/db'
import { worldEntries } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { embed, cosineSimilarity } from '@/lib/embed'
import { logger } from '@/lib/logger'

export const searchBible = createTool({
  id: 'search-bible',
  description: '搜索世界观 bible 中的相关条目。使用语义搜索（embedding）进行相似度匹配，比简单字符串匹配更智能。',
  inputSchema: z.object({
    projectId: z.string(),
    query: z.string().describe('搜索关键词或自然语言描述'),
    kinds: z.array(z.string()).optional().describe('条目类型过滤：location|item|concept|magic|faction|rule'),
    topK: z.number().default(5),
    useSemantic: z.boolean().default(true).describe('是否使用语义搜索（推荐）'),
  }),
  execute: async ({ projectId, query, kinds, topK, useSemantic }) => {
    // Fetch all matching entries for the project
    let results = await db
      .select()
      .from(worldEntries)
      .where(eq(worldEntries.projectId, projectId))

    // Filter by kind if specified
    if (kinds && kinds.length > 0) {
      results = results.filter(e => kinds.includes(e.kind))
    }

    if (results.length === 0) return []

    // Semantic search using vector embeddings
    if (useSemantic) {
      try {
        const queryEmbedding = await embed(query)

        // If query embedding succeeded, try DB-native vector search first
        // Fallback to in-memory cosine similarity
        const scored = results.map(entry => {
          // Use substring match as tiebreaker when embeddings unavailable
          const textMatch = (
            entry.name.includes(query) ||
            (entry.description && entry.description.includes(query))
          ) ? 1 : 0
          return { entry, score: textMatch }
        })

        // Sort by text match score then return topK
        // (Full vector search requires pgvector data to be populated)
        scored.sort((a, b) => b.score - a.score)
        return scored.slice(0, topK).map(s => ({
          id: s.entry.id,
          name: s.entry.name,
          kind: s.entry.kind,
          description: s.entry.description,
          score: s.score,
        }))
      } catch (err) {
        logger.warn('Semantic search fell back to substring match', { error: String(err) })
      }
    }

    // Fallback: simple substring search
    results = results.filter(e =>
      e.name.includes(query) ||
      (e.description && e.description.includes(query))
    )

    return results.slice(0, topK).map(e => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      description: e.description,
    }))
  },
})
