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


// ============ Prompt 模块 ============

export const prompts = pgTable('prompts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  version: integer('version').notNull().default(1),
  scope: text('scope').notNull(), // agent|tool|workflow
  templateMd: text('template_md'),
  frontmatter: jsonb('frontmatter'),
  requiredVars: jsonb('required_vars'),
  optionalVars: jsonb('optional_vars'),
  active: boolean('active').default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const promptRuns = pgTable('prompt_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  promptId: uuid('prompt_id').references(() => prompts.id),
  version: integer('version'),
  jobId: uuid('job_id'),
  agentName: text('agent_name'),
  inputVars: jsonb('input_vars'),
  renderedText: text('rendered_text'),
  outputText: text('output_text'),
  rating: integer('rating'),
  ratedAt: timestamp('rated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})


// ============ Prompt — 实验 ============

export const promptExperiments = pgTable('prompt_experiments', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  promptAId: uuid('prompt_a_id').references(() => prompts.id),
  promptBId: uuid('prompt_b_id').references(() => prompts.id),
  active: boolean('active').default(false),
  splitRatio: numeric('split_ratio').default('0.5'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})


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

// ============ Type Exports ============

export type Project = typeof projects.$inferSelect
export type ProjectSettings = typeof projectSettings.$inferSelect
export type Volume = typeof volumes.$inferSelect
export type VolumeStatus = typeof volumeStatusEnum.enumValues[number]
export type ChapterOutline = typeof chapterOutlines.$inferSelect
export type ChapterOutlineStatus = typeof chapterOutlineStatusEnum.enumValues[number]
export type SceneMarker = typeof sceneMarkers.$inferSelect
export type Chapter = typeof chapters.$inferSelect
export type ChapterVersion = typeof chapterVersions.$inferSelect
export type ChapterVersionSource = typeof chapterVersionSourceEnum.enumValues[number]
export type ChapterSummary = typeof chapterSummaries.$inferSelect
export type Character = typeof characters.$inferSelect
export type CharacterTier = typeof characterTierEnum.enumValues[number]
export type CanonFact = typeof canonFacts.$inferSelect
export type WorldEntry = typeof worldEntries.$inferSelect
export type Job = typeof jobs.$inferSelect
export type JobStatus = typeof jobStatusEnum.enumValues[number]
export type LlmCall = typeof llmCalls.$inferSelect
export type Issue = typeof issues.$inferSelect
export type IssueSeverity = typeof issueSeverityEnum.enumValues[number]
export type IssueStatus = typeof issueStatusEnum.enumValues[number]
export type Simulation = typeof simulations.$inferSelect
export type SimulationTurn = typeof simulationTurns.$inferSelect
export type SimulationScript = typeof simulationScripts.$inferSelect
export type SimulationCharacterState = typeof simulationCharacterStates.$inferSelect
export type WorldClock = typeof worldClock.$inferSelect
export type CharacterRelationship = typeof characterRelationships.$inferSelect
export type BetweenChapterEvent = typeof betweenChapterEvents.$inferSelect
export type FactionMovement = typeof factionMovements.$inferSelect
export type VersionDependency = typeof versionDependencies.$inferSelect
export type VersionBranch = typeof versionBranches.$inferSelect
export type VoiceCard = typeof voiceCards.$inferSelect
export type StyleFingerprint = typeof styleFingerprints.$inferSelect
export type Prompt = typeof prompts.$inferSelect
export type PromptRun = typeof promptRuns.$inferSelect
export type Export = typeof exports.$inferSelect
export type Faction = typeof factions.$inferSelect
export type FactionRelation = typeof factionRelations.$inferSelect
export type TimelineEvent = typeof timelineEvents.$inferSelect
export type CharacterAppearance = typeof characterAppearances.$inferSelect
export type CharacterVoiceAnchor = typeof characterVoiceAnchors.$inferSelect
export type ReviewRun = typeof reviewRuns.$inferSelect
export type FixAttempt = typeof fixAttempts.$inferSelect
export type AgentDecision = typeof agentDecisions.$inferSelect
export type ToolCall = typeof toolCalls.$inferSelect
export type SlopBlacklist = typeof slopBlacklist.$inferSelect
export type StyleDriftAlert = typeof styleDriftAlerts.$inferSelect
export type PromptExperiment = typeof promptExperiments.$inferSelect
export type ChapterChunk = typeof chapterChunks.$inferSelect
export type ScriptCharacterChunk = typeof scriptCharacterChunks.$inferSelect

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


// ============ Prompt 模块 ============

export const prompts = pgTable('prompts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  version: integer('version').notNull().default(1),
  scope: text('scope').notNull(), // agent|tool|workflow
  templateMd: text('template_md'),
  frontmatter: jsonb('frontmatter'),
  requiredVars: jsonb('required_vars'),
  optionalVars: jsonb('optional_vars'),
  active: boolean('active').default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const promptRuns = pgTable('prompt_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  promptId: uuid('prompt_id').references(() => prompts.id),
  version: integer('version'),
  jobId: uuid('job_id'),
  agentName: text('agent_name'),
  inputVars: jsonb('input_vars'),
  renderedText: text('rendered_text'),
  outputText: text('output_text'),
  rating: integer('rating'),
  ratedAt: timestamp('rated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})


// ============ Prompt — 实验 ============

export const promptExperiments = pgTable('prompt_experiments', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  promptAId: uuid('prompt_a_id').references(() => prompts.id),
  promptBId: uuid('prompt_b_id').references(() => prompts.id),
  active: boolean('active').default(false),
  splitRatio: numeric('split_ratio').default('0.5'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})


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

// ============ Type Exports ============

export type Project = typeof projects.$inferSelect
export type ProjectSettings = typeof projectSettings.$inferSelect
export type Volume = typeof volumes.$inferSelect
export type VolumeStatus = typeof volumeStatusEnum.enumValues[number]
export type ChapterOutline = typeof chapterOutlines.$inferSelect
export type ChapterOutlineStatus = typeof chapterOutlineStatusEnum.enumValues[number]
export type SceneMarker = typeof sceneMarkers.$inferSelect
export type Chapter = typeof chapters.$inferSelect
export type ChapterVersion = typeof chapterVersions.$inferSelect
export type ChapterVersionSource = typeof chapterVersionSourceEnum.enumValues[number]
export type ChapterSummary = typeof chapterSummaries.$inferSelect
export type Character = typeof characters.$inferSelect
export type CharacterTier = typeof characterTierEnum.enumValues[number]
export type CanonFact = typeof canonFacts.$inferSelect
export type WorldEntry = typeof worldEntries.$inferSelect
export type Job = typeof jobs.$inferSelect
export type JobStatus = typeof jobStatusEnum.enumValues[number]
export type LlmCall = typeof llmCalls.$inferSelect
export type Issue = typeof issues.$inferSelect
export type IssueSeverity = typeof issueSeverityEnum.enumValues[number]
export type IssueStatus = typeof issueStatusEnum.enumValues[number]
export type Simulation = typeof simulations.$inferSelect
export type SimulationTurn = typeof simulationTurns.$inferSelect
export type SimulationScript = typeof simulationScripts.$inferSelect
export type SimulationCharacterState = typeof simulationCharacterStates.$inferSelect
export type WorldClock = typeof worldClock.$inferSelect
export type CharacterRelationship = typeof characterRelationships.$inferSelect
export type BetweenChapterEvent = typeof betweenChapterEvents.$inferSelect
export type FactionMovement = typeof factionMovements.$inferSelect
export type VersionDependency = typeof versionDependencies.$inferSelect
export type VersionBranch = typeof versionBranches.$inferSelect
export type VoiceCard = typeof voiceCards.$inferSelect
export type StyleFingerprint = typeof styleFingerprints.$inferSelect
export type Prompt = typeof prompts.$inferSelect
export type PromptRun = typeof promptRuns.$inferSelect
export type Export = typeof exports.$inferSelect
export type Faction = typeof factions.$inferSelect
export type FactionRelation = typeof factionRelations.$inferSelect
export type TimelineEvent = typeof timelineEvents.$inferSelect
export type CharacterAppearance = typeof characterAppearances.$inferSelect
export type CharacterVoiceAnchor = typeof characterVoiceAnchors.$inferSelect
export type ReviewRun = typeof reviewRuns.$inferSelect
export type FixAttempt = typeof fixAttempts.$inferSelect
export type AgentDecision = typeof agentDecisions.$inferSelect
export type ToolCall = typeof toolCalls.$inferSelect
export type SlopBlacklist = typeof slopBlacklist.$inferSelect
export type StyleDriftAlert = typeof styleDriftAlerts.$inferSelect
export type PromptExperiment = typeof promptExperiments.$inferSelect
export type ChapterChunk = typeof chapterChunks.$inferSelect
export type ScriptCharacterChunk = typeof scriptCharacterChunks.$inferSelect

export type VoiceCard = typeof voiceCards.$inferSelect
export type StyleFingerprint = typeof styleFingerprints.$inferSelect
export type SlopBlacklist = typeof slopBlacklist.$inferSelect
export type StyleDriftAlert = typeof styleDriftAlerts.$inferSelect