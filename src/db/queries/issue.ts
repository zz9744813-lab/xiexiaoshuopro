// src/db/queries/issue.ts — Issue / Review query helpers
import { eq, desc, and, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { issues, fixAttempts } from '@/db/schema'

/** Create a new issue */
export async function createIssue(params: {
  projectId: string
  chapterId: string
  axis: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  evidence: string
  proposedFix?: string
}) {
  const [issue] = await db
    .insert(issues)
    .values({
      projectId: params.projectId,
      chapterId: params.chapterId,
      axis: params.axis,
      severity: params.severity,
      title: params.title,
      description: params.description,
      evidence: params.evidence,
      proposedFix: params.proposedFix || null,
    })
    .returning()
  return issue
}

/** List open issues for a project */
export async function listOpenIssues(projectId: string) {
  return db
    .select()
    .from(issues)
    .where(and(eq(issues.projectId, projectId), inArray(issues.status, ['open', 'in_progress'])))
    .orderBy(desc(issues.createdAt))
}

/** Apply a fix attempt */
export async function applyFix(params: {
  issueId: string
  agentId: string
  beforeMd: string
  afterMd: string
  diff?: string
}) {
  const [fix] = await db
    .insert(fixAttempts)
    .values({
      issueId: params.issueId,
      agentId: params.agentId,
      beforeMd: params.beforeMd,
      afterMd: params.afterMd,
      diff: params.diff || null,
    })
    .returning()

  // Mark issue as resolved
  await db.update(issues).set({ status: 'resolved' }).where(eq(issues.id, params.issueId))

  return fix
}

/** Get issues for a chapter */
export async function getChapterIssues(chapterId: string) {
  return db
    .select()
    .from(issues)
    .where(eq(issues.chapterId, chapterId))
    .orderBy(desc(issues.createdAt))
}
