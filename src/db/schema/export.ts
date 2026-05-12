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
import { jobStatusEnum } from './enums'

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

export type Export = typeof exports.$inferSelect