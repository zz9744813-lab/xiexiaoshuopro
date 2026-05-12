// src/db/schema/plot.ts - Foreshadowing tracking
import { pgTable, uuid, text, integer, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { projects } from './project'
import { chapters } from './generation'
import { vector } from './_pgvector'

// Enums
export const foreshadowingStatusEnum = pgEnum('foreshadowing_status', [
  'planted',
  'developing',
  'paying_off',
  'paid_off',
  'abandoned',
])

export const foreshadowingKindEnum = pgEnum('foreshadowing_kind', [
  'mystery',
  'setup',
  'character_arc',
  'symbol',
  'prop',
  'prophecy',
  'debt',
])

export const foreshadowingCheckEventTypeEnum = pgEnum('foreshadowing_check_event_type', [
  'plant',
  'reinforce',
  'hint',
  'misdirect',
  'payoff',
])

// Tables
export const foreshadowings = pgTable('foreshadowings', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  kind: foreshadowingKindEnum('kind').notNull(),
  status: foreshadowingStatusEnum('status').default('planted'),
  importance: integer('importance').default(5),
  introducedChapterId: uuid('introduced_chapter_id').references(() => chapters.id),
  expectedPayoffRange: jsonb('expected_payoff_range'),
  paidOffChapterId: uuid('paid_off_chapter_id').references(() => chapters.id),
  abandonedReason: text('abandoned_reason'),
  embedding: vector('embedding'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const foreshadowingChecks = pgTable('foreshadowing_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  foreshadowingId: uuid('foreshadowing_id').references(() => foreshadowings.id, { onDelete: 'cascade' }).notNull(),
  chapterId: uuid('chapter_id').references(() => chapters.id, { onDelete: 'cascade' }).notNull(),
  eventType: foreshadowingCheckEventTypeEnum('event_type').notNull(),
  description: text('description'),
  evidence: text('evidence'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Foreshadowing = typeof foreshadowings.$inferSelect
export type ForeshadowingCheck = typeof foreshadowingChecks.$inferSelect
