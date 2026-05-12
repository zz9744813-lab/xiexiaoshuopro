import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
  uuid,
  numeric,
} from 'drizzle-orm/pg-core'
import { projects } from './project'
import { jobStatusEnum } from './enums'

// ============ Observability 模块 ============

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id),
  type: text('type').notNull(),
  status: jobStatusEnum('status').default('pending'),
  workflowName: text('workflow_name'),
  workflowRunId: text('workflow_run_id'),
  input: jsonb('input'),
  output: jsonb('output'),
  parentJobId: uuid('parent_job_id'),
  errorText: text('error_text'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  totalCostUsd: numeric('total_cost_usd'),
  totalTokensIn: integer('total_tokens_in'),
  totalTokensOut: integer('total_tokens_out'),
})

export const llmCalls = pgTable('llm_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => jobs.id),
  agentName: text('agent_name'),
  provider: text('provider'),
  model: text('model'),
  promptId: text('prompt_id'),
  promptVersion: integer('prompt_version'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  costUsd: numeric('cost_usd'),
  durationMs: integer('duration_ms'),
  finishReason: text('finish_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})


// ============ Observability — 决策与工具调用 ============

export const agentDecisions = pgTable('agent_decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => jobs.id),
  agentName: text('agent_name').notNull(),
  decisionType: text('decision_type').notNull(),
  contextSummary: text('context_summary'),
  chosenOption: text('chosen_option'),
  alternativesConsidered: jsonb('alternatives_considered'),
  rationale: text('rationale'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const toolCalls = pgTable('tool_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => jobs.id),
  agentName: text('agent_name'),
  toolName: text('tool_name').notNull(),
  input: jsonb('input'),
  output: jsonb('output'),
  durationMs: integer('duration_ms'),
  errorText: text('error_text'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})



export type Job = typeof jobs.$inferSelect
export type JobStatus = typeof jobStatusEnum.$inferSelect
export type LlmCall = typeof llmCalls.$inferSelect
export type AgentDecision = typeof agentDecisions.$inferSelect
export type ToolCall = typeof toolCalls.$inferSelect