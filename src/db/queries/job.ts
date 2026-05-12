// src/db/queries/job.ts
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { jobs, llmCalls } from '@/db/schema'

export async function startJob(params: {
  projectId: string
  type: string
  input?: Record<string, unknown>
  workflowName?: string
  workflowRunId?: string
}) {
  const [job] = await db.insert(jobs).values({
    projectId: params.projectId,
    type: params.type,
    input: params.input ?? {},
    workflowName: params.workflowName,
    workflowRunId: params.workflowRunId,
    status: 'running',
    startedAt: new Date(),
  }).returning()
  return job
}

export async function completeJob(jobId: string, output?: Record<string, unknown>) {
  await db.update(jobs).set({
    status: 'completed',
    completedAt: new Date(),
    output: output ?? {},
  }).where(eq(jobs.id, jobId))
}

export async function failJob(jobId: string, errorText: string) {
  await db.update(jobs).set({
    status: 'failed',
    completedAt: new Date(),
    errorText,
  }).where(eq(jobs.id, jobId))
}

export async function logLlmCall(params: {
  jobId: string
  agentName?: string
  provider?: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  durationMs?: number
  finishReason?: string
}) {
  const [log] = await db.insert(llmCalls).values({
    jobId: params.jobId,
    agentName: params.agentName,
    provider: params.provider,
    model: params.model,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    costUsd: String(params.costUsd),
    durationMs: params.durationMs,
    finishReason: params.finishReason,
  }).returning()
  return log
}
