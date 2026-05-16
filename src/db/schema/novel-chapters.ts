import { pgTable, uuid, text, timestamp, jsonb, integer, numeric, index } from 'drizzle-orm/pg-core';
import { worlds } from './worlds';
import { worldlines } from './worldlines';

/**
 * Per spec 35 - novel chapters produced by the narrator.
 * Per spec 7.3 - narrator output is the literary form of already-occurred sim.
 */
export const novelChapters = pgTable('novel_chapters', {
  id: uuid('id').primaryKey().defaultRandom(),
  worldId: uuid('world_id').notNull().references(() => worlds.id),
  worldlineId: uuid('worldline_id').notNull().references(() => worldlines.id),
  chapterIndex: integer('chapter_index').notNull(),

  title: text('title').notNull(),
  contentMarkdown: text('content_markdown').notNull(),
  pov: text('pov'),
  styleProfile: jsonb('style_profile').notNull().default({}),

  sourceEventIds: uuid('source_event_ids').array().notNull().default([]),
  sourceSceneIds: uuid('source_scene_ids').array().notNull().default([]),

  faithfulnessScore: numeric('faithfulness_score', { precision: 4, scale: 3 }),
  faithfulnessReport: jsonb('faithfulness_report'),
  changedMajorFacts: text('changed_major_facts').array().notNull().default([]),

  promptVersionId: uuid('prompt_version_id'),
  apiProfileId: uuid('api_profile_id'),
  generationTraceId: uuid('generation_trace_id'),

  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_novel_chapters_worldline').on(table.worldlineId, table.chapterIndex),
]);

export const CHAPTER_STATUSES = ['draft', 'reviewing', 'published', 'archived'] as const;
