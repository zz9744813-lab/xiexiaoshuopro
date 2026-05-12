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
import { issueSeverityEnum } from './enums'

// ============ Style 模块 ============

export const voiceCards = pgTable('voice_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  scope: text('scope').notNull(), // project|character|narrator
  scopeId: text('scope_id'),
  cardMd: text('card_md'),
  positiveSamples: jsonb('positive_samples'),
  negativeSamples: jsonb('negative_samples'),
  doUseWords: jsonb('do_use_words'),
  dontUseWords: jsonb('dont_use_words'),
  preferredSentenceLength: text('preferred_sentence_length'),
  preferredPov: text('preferred_pov'),
  activeVersion: integer('active_version').default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const styleFingerprints = pgTable('style_fingerprints', {
  id: uuid('id').primaryKey().defaultRandom(),
  chapterId: uuid('chapter_id').references(() => chapters.id),
  versionId: uuid('version_id'),
  avgSentenceLength: numeric('avg_sentence_length'),
  sentenceLengthVariance: numeric('sentence_length_variance'),
  vocabRichness: numeric('vocab_richness'),
  metaphorDensity: numeric('metaphor_density'),
  dialogueRatio: numeric('dialogue_ratio'),
  repeatedPhrases: jsonb('repeated_phrases'),
  computedAt: timestamp('computed_at').defaultNow().notNull(),
})


// ============ Style — 黑名单与漂移告警 ============

export const slopBlacklist = pgTable('slop_blacklist', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  pattern: text('pattern').notNull(),
  isRegex: boolean('is_regex').default(false),
  category: text('category').notNull(),
  replacementStrategy: text('replacement_strategy'),
  enabled: boolean('enabled').default(true),
  hitCount: integer('hit_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const styleDriftAlerts = pgTable('style_drift_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  detectedInChapterId: uuid('detected_in_chapter_id'),
  driftAxis: text('drift_axis').notNull(),
  baselineValue: numeric('baseline_value'),
  currentValue: numeric('current_value'),
  severity: issueSeverityEnum('severity').default('warning'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})



export type VoiceCard = typeof voiceCards.$inferSelect
export type StyleFingerprint = typeof styleFingerprints.$inferSelect
export type SlopBlacklist = typeof slopBlacklist.$inferSelect
export type StyleDriftAlert = typeof styleDriftAlerts.$inferSelect