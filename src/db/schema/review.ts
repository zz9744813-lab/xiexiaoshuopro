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
import { issueSeverityEnum, issueStatusEnum } from './enums'

// ============ Review / Issue 模块 ============

export const issues = pgTable('issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  scope: text('scope').notNull(), // paragraph|scene|chapter|volume|book|character|world
  scopeId: text('scope_id'),
  axis: text('axis').notNull(), // logic|voice|canon|pacing|theme|genre|reader|aislop|...
  severity: issueSeverityEnum('severity').default('warning'),
  title: text('title').notNull(),
  description: text('description'),
  evidence: text('evidence'),
  proposedFix: text('proposed_fix'),
  proposedFixDiff: text('proposed_fix_diff'),
  status: issueStatusEnum('status').default('open'),
  reviewerAgent: text('reviewer_agent'),
  relatedIssueIds: jsonb('related_issue_ids'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  dismissedReason: text('dismissed_reason'),
})


// ============ Review — 审计记录与修复尝试 ============

export const reviewRuns = pgTable('review_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  scope: text('scope').notNull(),
  scopeId: text('scope_id'),
  reviewersInvoked: jsonb('reviewers_invoked'),
  totalIssuesFound: integer('total_issues_found').default(0),
  totalCritical: integer('total_critical').default(0),
  durationMs: integer('duration_ms'),
  costUsd: numeric('cost_usd'),
  triggeredBy: text('triggered_by').default('auto'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const fixAttempts = pgTable('fix_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  issueId: uuid('issue_id').references(() => issues.id, { onDelete: 'cascade' }).notNull(),
  attemptIdx: integer('attempt_idx').notNull(),
  fixAgent: text('fix_agent'),
  beforeText: text('before_text'),
  afterText: text('after_text'),
  diffMd: text('diff_md'),
  outcome: text('outcome'),
  costUsd: numeric('cost_usd'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})



export type Issue = typeof issues.$inferSelect
export type IssueSeverity = typeof issueSeverityEnum.$inferSelect
export type IssueStatus = typeof issueStatusEnum.$inferSelect
export type ReviewRun = typeof reviewRuns.$inferSelect
export type FixAttempt = typeof fixAttempts.$inferSelect