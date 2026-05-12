// mastra/tools/apply-fix.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { fixAttempts, issues } from '@/db/schema'
import { eq, count } from 'drizzle-orm'

export const applyFix = createTool({
  id: 'apply-fix',
  description: '应用修复到章节并记录 fix attempt',
  inputSchema: z.object({
    issueId: z.string(),
    fixAgent: z.string(),
    beforeText: z.string(),
    afterText: z.string(),
    diffMd: z.string().optional(),
    outcome: z.enum(['success', 'partial', 'failed']).default('success'),
  }),
  execute: async ({ issueId, fixAgent, beforeText, afterText, diffMd, outcome }) => {
    const [{ value: prevCount }] = await db
      .select({ value: count() })
      .from(fixAttempts)
      .where(eq(fixAttempts.issueId, issueId))

    const [fix] = await db.insert(fixAttempts).values({
      issueId,
      attemptIdx: Number(prevCount) + 1,
      fixAgent,
      beforeText,
      afterText,
      diffMd,
      outcome,
    }).returning()

    if (outcome === 'success') {
      await db.update(issues)
        .set({ status: 'auto_fixed', resolvedAt: new Date() })
        .where(eq(issues.id, issueId))
    }

    return { fixId: fix.id, issueId, attemptIdx: fix.attemptIdx }
  },
})
