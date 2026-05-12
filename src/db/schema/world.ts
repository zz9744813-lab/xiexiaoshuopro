import { vector } from './_pgvector'
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

// ============ World / Bible 模块 ============

export const canonFacts = pgTable('canon_facts', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  fact: text('fact').notNull(),
  category: text('category'),
  sourceChapterId: uuid('source_chapter_id'),
  immutable: boolean('immutable').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const worldEntries = pgTable('world_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  kind: text('kind').notNull(), // location|item|concept|magic|faction|rule
  name: text('name').notNull(),
  description: text('description'),
  embedding: vector('embedding'),
  rules: text('rules'),
  parentId: uuid('parent_id'),
  appearanceCount: integer('appearance_count').default(0),
  firstAppearanceChapterId: uuid('first_appearance_chapter_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})


// ============ World / Bible — 势力与时间线 ============

export const factions = pgTable('factions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  ideology: text('ideology'),
  powerLevel: integer('power_level'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const factionRelations = pgTable('faction_relations', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  factionA: uuid('faction_a').references(() => factions.id, { onDelete: 'cascade' }).notNull(),
  factionB: uuid('faction_b').references(() => factions.id, { onDelete: 'cascade' }).notNull(),
  relation: text('relation').notNull(), // ally|enemy|neutral|tense|trade
  notes: text('notes'),
  changedInChapterId: uuid('changed_in_chapter_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const timelineEvents = pgTable('timeline_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  worldYear: text('world_year'),
  storyChapterId: uuid('story_chapter_id'),
  eventText: text('event_text').notNull(),
  participants: jsonb('participants'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})



export type CanonFact = typeof canonFacts.$inferSelect
export type WorldEntry = typeof worldEntries.$inferSelect
export type Faction = typeof factions.$inferSelect
export type FactionRelation = typeof factionRelations.$inferSelect
export type TimelineEvent = typeof timelineEvents.$inferSelect
