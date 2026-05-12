// src/db/queries/job.ts — Observability / Job query helpers
import { eq, desc } from 'drizzle-orm'
import { db } from '@/db'
import { jobs, llmCalls } from '@/db/schema'

/** Start a job (returns job record) */
export async function startJob(params: {
  projectId: string
  type: string
  context?: Record<string, unknown>
}) {
  const [job] = await db
    .insert(jobs)
    .values({
      projectId: params.projectId,
      type: params.type,
      context: params.context || {},
      status: 'running',
      startedAt: new Date(),
    })
    .returning()
  return job
}

/** Mark a job as completed */
export async function completeJob(jobId: string, result?: Record<string, unknown>) {
  await db
    .update(jobs)
    .set({ status: 'completed', completedAt: new Date(), result: result || {} })
    .where(eq(jobs.id, jobId))
}

/** Log an LLM call */
export async function logLlmCall(params: {
  jobId: string
  model: string
  promptTokens: number
  completionTokens: number
  cost: number
  metadata?: Record<string, unknown>
}) {
  const [log] = await db
    .insert(llmCalls)
    .values({
      jobId: params.jobId,
      model: params.model,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      cost: params.cost,
      metadata: params.metadata || {},
    })
    .returning()
  return log
}

/** Get recent jobs for a project */
export async function getProjectJobs(projectId: string, limit = 20) {
  return db
    .select()
    .from(jobs)
    .where(eq(jobs.projectId, projectId))
    .orderBy(desc(jobs.startedAt))
    .limit(limit)
}
