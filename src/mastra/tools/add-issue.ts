// mastra/tools/add-issue.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { issues } from '@/db/schema'

export const addIssue = createTool({
  id: 'add-issue',
  description: '创建一个审查 issue',
  inputSchema: z.object({
    projectId: z.string(),
    scope: z.enum(['paragraph', 'scene', 'chapter', 'volume', 'book', 'character', 'world']),
    scopeId: z.string().optional(),
    axis: z.enum(['logic', 'voice', 'canon', 'pacing', 'theme', 'genre', 'reader', 'aislop', 'continuity']),
    severity: z.enum(['critical', 'warning', 'info']),
    title: z.string(),
    description: z.string().optional(),
    evidence: z.string().optional(),
    proposedFix: z.string().optional(),
    reviewerAgent: z.string().optional(),
  }),
  execute: async (input) => {
    const [issue] = await db
      .insert(issues)
      .values({
        projectId: input.projectId,
        scope: input.scope,
        scopeId: input.scopeId,
        axis: input.axis,
        severity: input.severity,
        title: input.title,
        description: input.description,
        evidence: input.evidence,
        proposedFix: input.proposedFix,
        reviewerAgent: input.reviewerAgent,
        status: 'open',
      })
      .returning()

    return { issueId: issue.id }
  },
})
