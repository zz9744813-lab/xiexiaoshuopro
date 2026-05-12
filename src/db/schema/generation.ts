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
import { chapterOutlines } from './outline'
import { chapterOutlineStatusEnum, chapterVersionSourceEnum } from './enums'

// ============ Generation 模块 ============

export const chapters = pgTable('chapters', {
  id: uuid('id').primaryKey().defaultRandom(),
  chapterOutlineId: uuid('chapter_outline_id').references(() => chapterOutlines.id).notNull(),
  chapterNum: integer('chapter_num').notNull(),
  title: text('title').notNull(),
  status: chapterOutlineStatusEnum('status').default('outline'),
  activeVersionId: uuid('active_version_id'),
  finalizedAt: timestamp('finalized_at'),
  finalizedWordCount: integer('finalized_word_count'),
})

export const chapterVersions = pgTable('chapter_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  chapterId: uuid('chapter_id').references(() => chapters.id, { onDelete: 'cascade' }).notNull(),
  versionLabel: text('version_label'),
  contentMd: text('content_md'),
  source: chapterVersionSourceEnum('source').default('initial'),
  parentVersionId: uuid('parent_version_id'),
  diffFromParent: text('diff_from_parent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: text('created_by'),
})

export const chapterSummaries = pgTable('chapter_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  chapterId: uuid('chapter_id').references(() => chapters.id, { onDelete: 'cascade' }).notNull(),
  versionId: uuid('version_id'),
  shortSummary: text('short_summary'),
  longSummary: text('long_summary'),
  emotionalArc: text('emotional_arc'),
  keyEvents: jsonb('key_events'),
  readerQuestionsRaised: jsonb('reader_questions_raised'),
  readerQuestionsAnswered: jsonb('reader_questions_answered'),
  embedding: vector('embedding'),
})


// ============ Generation — RAG 分块 ============

export const chapterChunks = pgTable('chapter_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  chapterId: uuid('chapter_id').references(() => chapters.id, { onDelete: 'cascade' }).notNull(),
  chunkText: text('chunk_text').notNull(),
  chunkIdx: integer('chunk_idx').notNull(),
  povCharacterId: uuid('pov_character_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  embedding: vector('embedding'),
})



export type Chapter = typeof chapters.$inferSelect
export type ChapterVersion = typeof chapterVersions.$inferSelect
export type ChapterVersionSource = typeof chapterVersionSourceEnum.$inferSelect
export type ChapterSummary = typeof chapterSummaries.$inferSelect
export type ChapterChunk = typeof chapterChunks.$inferSelect