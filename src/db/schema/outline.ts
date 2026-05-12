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
import { volumeStatusEnum, chapterOutlineStatusEnum, sceneTypeEnum } from './enums'

// ============ Outline 模块 ============

export const volumes = pgTable('volumes', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  volumeNum: integer('volume_num').notNull(),
  title: text('title').notNull(),
  thesis: text('thesis'),
  arcBeats: jsonb('arc_beats'),
  readerPromise: text('reader_promise'),
  status: volumeStatusEnum('status').default('planning'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  finalizedAt: timestamp('finalized_at'),
})

export const chapterOutlines = pgTable('chapter_outlines', {
  id: uuid('id').primaryKey().defaultRandom(),
  volumeId: uuid('volume_id').references(() => volumes.id, { onDelete: 'cascade' }).notNull(),
  chapterNum: integer('chapter_num').notNull(),
  title: text('title').notNull(),
  beatsMd: text('beats_md'),
  targetWordCount: integer('target_word_count').default(5000),
  povCharacterId: uuid('pov_character_id'),
  primaryLocationId: uuid('primary_location_id'),
  charactersPresent: jsonb('characters_present'),
  deliversArcBeats: jsonb('delivers_arc_beats'),
  hookIntent: text('hook_intent'),
  status: chapterOutlineStatusEnum('status').default('outline'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const sceneMarkers = pgTable('scene_markers', {
  id: uuid('id').primaryKey().defaultRandom(),
  chapterOutlineId: uuid('chapter_outline_id').references(() => chapterOutlines.id, { onDelete: 'cascade' }).notNull(),
  order: integer('order').notNull(),
  sceneType: sceneTypeEnum('scene_type').notNull(),
  goal: text('goal'),
  povCharacterId: uuid('pov_character_id'),
  charactersPresent: jsonb('characters_present'),
  estimatedWords: integer('estimated_words'),
  isSimulationCandidate: boolean('is_simulation_candidate').default(false),
})


export type Volume = typeof volumes.$inferSelect
export type VolumeStatus = typeof volumeStatusEnum.$inferSelect
export type ChapterOutline = typeof chapterOutlines.$inferSelect
export type ChapterOutlineStatus = typeof chapterOutlineStatusEnum.$inferSelect
export type SceneMarker = typeof sceneMarkers.$inferSelect