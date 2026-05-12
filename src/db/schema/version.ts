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
import { chapters } from './generation'

// ============ Version 模块 ============

export const versionDependencies = pgTable('version_dependencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  downstreamChapterId: uuid('downstream_chapter_id').references(() => chapters.id).notNull(),
  upstreamChapterId: uuid('upstream_chapter_id').references(() => chapters.id).notNull(),
  upstreamVersionId: uuid('upstream_version_id'),
  dependencyType: text('dependency_type'), // summary|character_state|canon|world_event
  detectedAt: timestamp('detected_at').defaultNow().notNull(),
})

export const versionBranches = pgTable('version_branches', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  chapterId: uuid('chapter_id').references(() => chapters.id).notNull(),
  name: text('name').notNull(),
  headVersionId: uuid('head_version_id'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})


export type VersionDependency = typeof versionDependencies.$inferSelect
export type VersionBranch = typeof versionBranches.$inferSelect