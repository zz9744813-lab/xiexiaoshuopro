// db/queries/job.ts — 任务查询层
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { jobs, llmCalls, agentDecisions, toolCalls } from "@/db/schema";

/** 创建并开始任务 */
export async function startJob(input: {
  projectId: string;
  chapterId?: string;
  type: string;
  payload?: any;
}) {
  const [job] = await db
    .insert(jobs)
    .values({
      projectId: input.projectId,
      chapterId: input.chapterId,
      type: input.type,
      status: "running",
      payload: input.payload,
    })
    .returning();
  return job;
}

/** 完成任务 */
export async function completeJob(jobId: string, result?: any, error?: string) {
  const [job] = await db
    .update(jobs)
    .set({
      status: error ? "failed" : "done",
      result: result ?? null,
      error: error ?? null,
      finishedAt: new Date(),
    })
    .where(eq(jobs.id, jobId))
    .returning();
  return job;
}

/** 记录 LLM 调用 */
export async function logLlmCall(input: {
  jobId?: string;
  projectId: string;
  agentName: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  cost?: number;
  durationMs: number;
}) {
  const [call] = await db
    .insert(llmCalls)
    .values({
      jobId: input.jobId,
      projectId: input.projectId,
      agentName: input.agentName,
      modelId: input.modelId,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      cost: input.cost ? String(input.cost) : null,
      durationMs: input.durationMs,
    })
    .returning();
  return call;
}

/** 记录 Agent 决策 */
export async function logAgentDecision(input: {
  jobId?: string;
  projectId: string;
  agentName: string;
  context: any;
  decision: string;
  rationale: string;
  confidence?: number;
}) {
  const [decision] = await db
    .insert(agentDecisions)
    .values({
      jobId: input.jobId,
      projectId: input.projectId,
      agentName: input.agentName,
      context: input.context,
      decision: input.decision,
      rationale: input.rationale,
      confidence: input.confidence,
    })
    .returning();
  return decision;
}

/** 记录工具调用 */
export async function logToolCall(input: {
  llmCallId?: string;
  toolName: string;
  inputParams: any;
  outputResult: any;
  error?: string;
  durationMs: number;
}) {
  const [call] = await db
    .insert(toolCalls)
    .values({
      llmCallId: input.llmCallId,
      toolName: input.toolName,
      inputParams: input.inputParams,
      outputResult: input.outputResult,
      error: input.error,
      durationMs: input.durationMs,
    })
    .returning();
  return call;
}

/** 获取项目最近的 Jobs */
export async function listRecentJobs(projectId: string, limit = 20) {
  return db
    .select()
    .from(jobs)
    .where(eq(jobs.projectId, projectId))
    .orderBy(desc(jobs.createdAt))
    .limit(limit);
}

/** 获取 Job 关联的 LLM 调用 */
export async function getLlmCallsForJob(jobId: string) {
  return db
    .select()
    .from(llmCalls)
    .where(eq(llmCalls.jobId, jobId))
    .orderBy(desc(llmCalls.createdAt));
}
