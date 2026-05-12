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

// ============ Prompt 模块 ============

export const prompts = pgTable('prompts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  version: integer('version').notNull().default(1),
  scope: text('scope').notNull(), // agent|tool|workflow
  templateMd: text('template_md'),
  frontmatter: jsonb('frontmatter'),
  requiredVars: jsonb('required_vars'),
  optionalVars: jsonb('optional_vars'),
  active: boolean('active').default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const promptRuns = pgTable('prompt_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  promptId: uuid('prompt_id').references(() => prompts.id),
  version: integer('version'),
  jobId: uuid('job_id'),
  agentName: text('agent_name'),
  inputVars: jsonb('input_vars'),
  renderedText: text('rendered_text'),
  outputText: text('output_text'),
  rating: integer('rating'),
  ratedAt: timestamp('rated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})


// ============ Prompt — 实验 ============

export const promptExperiments = pgTable('prompt_experiments', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  promptAId: uuid('prompt_a_id').references(() => prompts.id),
  promptBId: uuid('prompt_b_id').references(() => prompts.id),
  active: boolean('active').default(false),
  splitRatio: numeric('split_ratio').default('0.5'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})



export type Prompt = typeof prompts.$inferSelect
export type PromptRun = typeof promptRuns.$inferSelect
export type PromptExperiment = typeof promptExperiments.$inferSelect