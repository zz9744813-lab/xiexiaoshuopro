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

// ============ Export 模块 ============

export const exports = pgTable('exports', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  format: text('format').notNull(), // md|epub|docx|pdf
  scope: text('scope').notNull(), // chapter|volume|full
  scopeId: text('scope_id'),
  config: jsonb('config'),
  outputPath: text('output_path'),
  status: jobStatusEnum('status').default('pending'),
  errorText: text('error_text'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
})


export type Export = typeof exports.$inferSelect