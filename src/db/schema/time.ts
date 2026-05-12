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

// ============ Time 模块 ============

export const worldClock = pgTable('world_clock', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  currentWorldDate: text('current_world_date'),
  currentChapterId: uuid('current_chapter_id'),
  paceConfig: jsonb('pace_config'),
})

export const betweenChapterEvents = pgTable('between_chapter_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  afterChapterId: uuid('after_chapter_id'),
  eventText: text('event_text').notNull(),
  visibility: text('visibility').notNull(), // hidden|hinted|revealed
  visibleToCharacters: jsonb('visible_to_characters'),
  triggersInChapterId: uuid('triggers_in_chapter_id'),
  createdByAgent: text('created_by_agent'),
  acknowledgedByUser: boolean('acknowledged_by_user').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const factionMovements = pgTable('faction_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  factionId: uuid('faction_id'),
  afterChapterId: uuid('after_chapter_id'),
  action: text('action'),
  targetFactionId: uuid('target_faction_id'),
  effect: text('effect'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})


export type WorldClock = typeof worldClock.$inferSelect
export type BetweenChapterEvent = typeof betweenChapterEvents.$inferSelect