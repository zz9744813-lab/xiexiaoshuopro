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
import { safetyLevelEnum } from './enums'

// ============ Project 模块 ============

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  genre: text('genre').notNull(),
  genreConfig: jsonb('genre_config'),
  voiceMd: text('voice_md'),
  authorNotes: text('author_notes'),
  modelRouting: jsonb('model_routing'),
  safetyLevel: safetyLevelEnum('safety_level').default('normal'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const projectSettings = pgTable('project_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  key: text('key').notNull(),
  value: jsonb('value'),
})


export type Project = typeof projects.$inferSelect
export type ProjectSettings = typeof projectSettings.$inferSelect