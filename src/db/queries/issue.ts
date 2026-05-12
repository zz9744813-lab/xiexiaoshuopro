// db/queries/issue.ts — Issue 查询层
import { eq, and, desc, inArray, asc } from "drizzle-orm";
import { db } from "@/db";
import { issues, reviewRuns, fixAttempts } from "@/db/schema";

/** 创建 Issue */
export async function createIssue(input: {
  projectId: string;
  chapterId: string;
  axis: string;
  severity: string;
  title: string;
  description: string;
  evidence?: string;
  proposedFix?: string;
  scope?: string;
  reviewRunId?: string;
}) {
  const [issue] = await db
    .insert(issues)
    .values({
      projectId: input.projectId,
      chapterId: input.chapterId,
      axis: input.axis,
      severity: input.severity as any,
      title: input.title,
      description: input.description,
      evidence: input.evidence,
      proposedFix: input.proposedFix,
      scope: input.scope,
      reviewRunId: input.reviewRunId,
      status: "open",
    })
    .returning();
  return issue;
}

/** 列出待处理 Issues */
export async function listOpenIssues(projectId: string, chapterId?: string) {
  const conditions = [eq(issues.projectId, projectId), eq(issues.status, "open")];
  if (chapterId) {
    conditions.push(eq(issues.chapterId, chapterId));
  }
  return db
    .select()
    .from(issues)
    .where(and(...conditions))
    .orderBy(desc(issues.createdAt));
}

/** 列出某次 Review 的全部 Issues */
export async function listIssuesByReview(reviewRunId: string) {
  return db
    .select()
    .from(issues)
    .where(eq(issues.reviewRunId, reviewRunId))
    .orderBy(asc(issues.axis));
}

/** 记录修复尝试 */
export async function applyFix(input: {
  issueId: string;
  attemptNumber: number;
  fixContent: string;
  diffPreview?: string;
  automated?: boolean;
}) {
  const [fix] = await db
    .insert(fixAttempts)
    .values({
      issueId: input.issueId,
      attemptNumber: input.attemptNumber,
      fixContent: input.fixContent,
      diffPreview: input.diffPreview,
      automated: input.automated ?? true,
    })
    .returning();
  return fix;
}

/** 更新 Issue 状态 */
export async function updateIssueStatus(issueId: string, status: string) {
  await db
    .update(issues)
    .set({ status: status as any })
    .where(eq(issues.id, issueId));
}

/** 创建 Review Run */
export async function createReviewRun(input: {
  projectId: string;
  chapterId: string;
  versionId: string;
}) {
  const [run] = await db
    .insert(reviewRuns)
    .values({
      projectId: input.projectId,
      chapterId: input.chapterId,
      versionId: input.versionId,
      status: "running",
    })
    .returning();
  return run;
}

/** 获取 Issue 的修复历史 */
export async function getFixAttempts(issueId: string) {
  return db
    .select()
    .from(fixAttempts)
    .where(eq(fixAttempts.issueId, issueId))
    .orderBy(asc(fixAttempts.attemptNumber));
}
