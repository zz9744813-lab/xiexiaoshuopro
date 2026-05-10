// db/schema.ts - Drizzle ORM Schema (MVP: Project + Volume + Chapter + Generation)
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

// ============ Enums ============

export const safetyLevelEnum = pgEnum('safety_level', ['strict', 'normal', 'unrestricted'])
export const volumeStatusEnum = pgEnum('volume_status', ['planning', 'writing', 'reviewing', 'done'])
export const chapterOutlineStatusEnum = pgEnum('chapter_outline_status', [
  'outline', 'drafting', 'drafted', 'reviewed', 'finalized', 'locked'
])
export const chapterVersionSourceEnum = pgEnum('chapter_version_source', [
  'initial', 'rewrite', 'simulation_inserted', 'manual', 'merge'
])
export const sceneTypeEnum = pgEnum('scene_type', [
  'dialogue', 'action', 'description', 'montage', 'interlude', 'simulation'
])
export const characterTierEnum = pgEnum('character_tier', ['principal', 'recurring', 'walk_on'])
export const issueSeverityEnum = pgEnum('issue_severity', ['critical', 'warning', 'info'])
export const issueStatusEnum = pgEnum('issue_status', [
  'open', 'in_progress', 'resolved', 'dismissed', 'auto_fixed', 'wont_fix'
])
export const jobStatusEnum = pgEnum('job_status', [
  'pending', 'running', 'completed', 'failed', 'cancelled'
])

// ============ Project 模块 ============

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  genre: text('genre').notNull(),
  genreConfig: jsonb('genre_config'),
  voiceMd: text('voice_md'),
  authorNotes: text('author_notes'),
  modelRouting: jsonb('model_routing'),
  safetyLevel: safetyLevelEnum('safety_level').default('normal'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const projectSettings = pgTable('project_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  key: text('key').notNull(),
  value: jsonb('value'),
})

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
})

// ============ Character 模块 ============

export const characters = pgTable('characters', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  tier: characterTierEnum('tier').default('walk_on'),
  appearance: text('appearance'),
  publicRole: text('public_role'),
  voiceMd: text('voice_md'),
  voiceSamples: jsonb('voice_samples'),
  secretMotive: text('secret_motive'),
  trueIntent: text('true_intent'),
  arcGoal: text('arc_goal'),
  arcPosition: integer('arc_position').default(0),
  arcMilestones: jsonb('arc_milestones'),
  currentEmotionalState: text('current_emotional_state'),
  currentLocationId: uuid('current_location_id'),
  alive: boolean('alive').default(true),
  appearanceCount: integer('appearance_count').default(0),
  firstAppearanceChapterId: uuid('first_appearance_chapter_id'),
  lastAppearanceChapterId: uuid('last_appearance_chapter_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

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
  rules: text('rules'),
  parentId: uuid('parent_id'),
  appearanceCount: integer('appearance_count').default(0),
  firstAppearanceChapterId: uuid('first_appearance_chapter_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ============ Observability 模块 ============

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id),
  type: text('type').notNull(),
  status: jobStatusEnum('status').default('pending'),
  workflowName: text('workflow_name'),
  workflowRunId: text('workflow_run_id'),
  input: jsonb('input'),
  output: jsonb('output'),
  parentJobId: uuid('parent_job_id'),
  errorText: text('error_text'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  totalCostUsd: numeric('total_cost_usd'),
  totalTokensIn: integer('total_tokens_in'),
  totalTokensOut: integer('total_tokens_out'),
})

export const llmCalls = pgTable('llm_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => jobs.id),
  agentName: text('agent_name'),
  provider: text('provider'),
  model: text('model'),
  promptId: text('prompt_id'),
  promptVersion: integer('prompt_version'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  costUsd: numeric('cost_usd'),
  durationMs: integer('duration_ms'),
  finishReason: text('finish_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ============ Review / Issue 模块 ============

export const issues = pgTable('issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  scope: text('scope').notNull(), // paragraph|scene|chapter|volume|book|character|world
  scopeId: text('scope_id'),
  axis: text('axis').notNull(), // logic|voice|canon|pacing|theme|genre|reader|aislop|...
  severity: issueSeverityEnum('severity').default('warning'),
  title: text('title').notNull(),
  description: text('description'),
  evidence: text('evidence'),
  proposedFix: text('proposed_fix'),
  proposedFixDiff: text('proposed_fix_diff'),
  status: issueStatusEnum('status').default('open'),
  reviewerAgent: text('reviewer_agent'),
  relatedIssueIds: jsonb('related_issue_ids'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  dismissedReason: text('dismissed_reason'),
})
