// mastra/tools/apply-fix.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { fixAttempts, issues } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const applyFix = createTool({
  id: 'apply-fix',
  description: '应用修复到章节并记录 fix attempt',
  inputSchema: z.object({
    issueId: z.string(),
    agentId: z.string(),
    beforeMd: z.string(),
    afterMd: z.string(),
    diff: z.string().optional(),
  }),
  execute: async ({ issueId, agentId, beforeMd, afterMd, diff }) => {
    const [fix] = await db.insert(fixAttempts).values({
      issueId,
      agentId,
      beforeMd,
      afterMd,
      diff: diff || null,
    }).returning()
    await db.update(issues).set({ status: 'resolved' }).where(eq(issues.id, issueId))
    return { fixId: fix.id, issueId }
  },
})
