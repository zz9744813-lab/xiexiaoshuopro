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
import { characters } from './character'

export const simulationStatusEnum = pgEnum('simulation_status', [
  'estimating', 'running', 'paused', 'done', 'failed', 'cancelled'
])

export const simulationTurnSpeakerEnum = pgEnum('simulation_turn_speaker', [
  'director', 'character', 'narrator', 'injection'
])

export const simulations = pgTable('simulations', {
  id: uuid('id').primaryKey().defaultRandom(),
  sceneMarkerId: uuid('scene_marker_id'),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  status: simulationStatusEnum('status').default('estimating'),
  estimatedCostUsd: numeric('estimated_cost_usd'),
  actualCostUsd: numeric('actual_cost_usd'),
  estimatedDurationSec: integer('estimated_duration_sec'),
  actualDurationSec: integer('actual_duration_sec'),
  charactersInvolved: jsonb('characters_involved'),
  directorGoal: text('director_goal'),
  directorConstraints: jsonb('director_constraints'),
  povChoice: text('pov_choice'),
  startingWorldState: jsonb('starting_world_state'),
  endingWorldState: jsonb('ending_world_state'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
})

export const simulationTurnSpeakerEnum = pgEnum('simulation_turn_speaker', [
  'director', 'character', 'narrator', 'injection'
])

export const simulationTurns = pgTable('simulation_turns', {
  id: uuid('id').primaryKey().defaultRandom(),
  simulationId: uuid('simulation_id').references(() => simulations.id, { onDelete: 'cascade' }).notNull(),
  turnIdx: integer('turn_idx').notNull(),
  speakerType: simulationTurnSpeakerEnum('speaker_type').notNull(),
  speakerId: text('speaker_id'),
  utterance: text('utterance'),
  reasoning: text('reasoning'),
  visibleTo: jsonb('visible_to'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const simulationScripts = pgTable('simulation_scripts', {
  id: uuid('id').primaryKey().defaultRandom(),
  simulationId: uuid('simulation_id').references(() => simulations.id, { onDelete: 'cascade' }).notNull(),
  scriptMd: text('script_md'),
  rawTurns: jsonb('raw_turns'),
  turnCount: integer('turn_count'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const simulationCharacterStates = pgTable('simulation_character_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  simulationId: uuid('simulation_id').references(() => simulations.id, { onDelete: 'cascade' }).notNull(),
  characterId: uuid('character_id').references(() => characters.id).notNull(),
  preKnowledgeSnapshot: jsonb('pre_knowledge_snapshot'),
  postKnowledgeSnapshot: jsonb('post_knowledge_snapshot'),
  knowledgeDelta: jsonb('knowledge_delta'),
  preEmotionalState: text('pre_emotional_state'),
  postEmotionalState: text('post_emotional_state'),
  preRelationships: jsonb('pre_relationships'),
  postRelationships: jsonb('post_relationships'),
})


// ============ Simulation — 角色剧本切片 ============

export const scriptCharacterChunks = pgTable('script_character_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  simulationScriptId: uuid('simulation_script_id').references(() => simulationScripts.id, { onDelete: 'cascade' }).notNull(),
  characterId: uuid('character_id').references(() => characters.id).notNull(),
  chunkText: text('chunk_text').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})


// ============ Memory 模块 ============

export const characterEpisodicMemory = pgTable('character_episodic_memory', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterId: uuid('character_id').references(() => characters.id, { onDelete: 'cascade' }).notNull(),
  episodeType: text('episode_type').notNull(), // conversation|action|witnessed|learned|felt
  summary: text('summary').notNull(),
  participants: jsonb('participants'),
  emotionalValence: integer('emotional_valence'), // -10..10
  importance: integer('importance'), // 0..10
  sourceChapterId: uuid('source_chapter_id'),
  sourceSimulationId: uuid('source_simulation_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const characterKnowledge = pgTable('character_knowledge', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterId: uuid('character_id').references(() => characters.id, { onDelete: 'cascade' }).notNull(),
  category: text('category').notNull(), // fact|suspected|lie
  content: text('content').notNull(),
  sourceChapterId: uuid('source_chapter_id'),
  sourceEvent: text('source_event'),
  certainty: integer('certainty'), // 0-100
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const characterRelationships = pgTable('character_relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterA: uuid('character_a').references(() => characters.id, { onDelete: 'cascade' }).notNull(),
  characterB: uuid('character_b').references(() => characters.id, { onDelete: 'cascade' }).notNull(),
  relationType: text('relation_type'), // family|romantic|hostile|mentor|...
  warmth: integer('warmth'), // -100..100
  trust: integer('trust'), // 0..100
  historyMd: text('history_md'),
  lastUpdatedChapterId: uuid('last_updated_chapter_id'),
})


// ============ Character — 出场与声音锚 ============

export const characterAppearances = pgTable('character_appearances', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterId: uuid('character_id').references(() => characters.id, { onDelete: 'cascade' }).notNull(),
  chapterId: uuid('chapter_id').references(() => chapters.id).notNull(),
  significance: integer('significance').default(0),
  pov: boolean('pov').default(false),
  sceneCount: integer('scene_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const characterVoiceAnchors = pgTable('character_voice_anchors', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterId: uuid('character_id').references(() => characters.id, { onDelete: 'cascade' }).notNull(),
  sampleText: text('sample_text').notNull(),
  context: text('context'),
  isCanonical: boolean('is_canonical').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})


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

// ============ Version 模块 ============

export const versionDependencies = pgTable('version_dependencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  downstreamChapterId: uuid('downstream_chapter_id').references(() => chapters.id).notNull(),
  upstreamChapterId: uuid('upstream_chapter_id').references(() => chapters.id).notNull(),
  upstreamVersionId: uuid('upstream_version_id'),
  dependencyType: text('dependency_type'), // summary|character_state|canon|world_event
  detectedAt: timestamp('detected_at').defaultNow().notNull(),
})

export const versionBranches = pgTable('version_branches', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  chapterId: uuid('chapter_id').references(() => chapters.id).notNull(),
  name: text('name').notNull(),
  headVersionId: uuid('head_version_id'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

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

// ============ Simulation — 角色剧本切片 ============

export const scriptCharacterChunks = pgTable('script_character_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  simulationScriptId: uuid('simulation_script_id').references(() => simulationScripts.id, { onDelete: 'cascade' }).notNull(),
  characterId: uuid('character_id').references(() => characters.id).notNull(),
  chunkText: text('chunk_text').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})


// ============ Memory 模块 ============

export const characterEpisodicMemory = pgTable('character_episodic_memory', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterId: uuid('character_id').references(() => characters.id, { onDelete: 'cascade' }).notNull(),
  episodeType: text('episode_type').notNull(), // conversation|action|witnessed|learned|felt
  summary: text('summary').notNull(),
  participants: jsonb('participants'),
  emotionalValence: integer('emotional_valence'), // -10..10
  importance: integer('importance'), // 0..10
  sourceChapterId: uuid('source_chapter_id'),
  sourceSimulationId: uuid('source_simulation_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const characterKnowledge = pgTable('character_knowledge', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterId: uuid('character_id').references(() => characters.id, { onDelete: 'cascade' }).notNull(),
  category: text('category').notNull(), // fact|suspected|lie
  content: text('content').notNull(),
  sourceChapterId: uuid('source_chapter_id'),
  sourceEvent: text('source_event'),
  certainty: integer('certainty'), // 0-100
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const characterRelationships = pgTable('character_relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterA: uuid('character_a').references(() => characters.id, { onDelete: 'cascade' }).notNull(),
  characterB: uuid('character_b').references(() => characters.id, { onDelete: 'cascade' }).notNull(),
  relationType: text('relation_type'), // family|romantic|hostile|mentor|...
  warmth: integer('warmth'), // -100..100
  trust: integer('trust'), // 0..100
  historyMd: text('history_md'),
  lastUpdatedChapterId: uuid('last_updated_chapter_id'),
})


// ============ Character — 出场与声音锚 ============

export const characterAppearances = pgTable('character_appearances', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterId: uuid('character_id').references(() => characters.id, { onDelete: 'cascade' }).notNull(),
  chapterId: uuid('chapter_id').references(() => chapters.id).notNull(),
  significance: integer('significance').default(0),
  pov: boolean('pov').default(false),
  sceneCount: integer('scene_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const characterVoiceAnchors = pgTable('character_voice_anchors', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterId: uuid('character_id').references(() => characters.id, { onDelete: 'cascade' }).notNull(),
  sampleText: text('sample_text').notNull(),
  context: text('context'),
  isCanonical: boolean('is_canonical').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})


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

// ============ Version 模块 ============

export const versionDependencies = pgTable('version_dependencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  downstreamChapterId: uuid('downstream_chapter_id').references(() => chapters.id).notNull(),
  upstreamChapterId: uuid('upstream_chapter_id').references(() => chapters.id).notNull(),
  upstreamVersionId: uuid('upstream_version_id'),
  dependencyType: text('dependency_type'), // summary|character_state|canon|world_event
  detectedAt: timestamp('detected_at').defaultNow().notNull(),
})

export const versionBranches = pgTable('version_branches', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  chapterId: uuid('chapter_id').references(() => chapters.id).notNull(),
  name: text('name').notNull(),
  headVersionId: uuid('head_version_id'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

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

export type Simulation = typeof simulations.$inferSelect
export type SimulationTurn = typeof simulationTurns.$inferSelect
export type SimulationScript = typeof simulationScripts.$inferSelect
export type SimulationCharacterState = typeof simulationCharacterStates.$inferSelect
export type ScriptCharacterChunk = typeof scriptCharacterChunks.$inferSelect