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

export const simulations = pgTable('simulations', {
  id: uuid('id').primaryKey().defaultRandom(),
  sceneMarkerId: uuid('scene_marker_id'),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  status: simulationStatusEnum('status').default('estimating'),

// ============ Simulation 模块 ============

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
  availableActions: jsonb('available_actions').default([]),
  moodTags: text('mood_tags').array().default([]),
  spatialContext: text('spatial_context'),
  sceneGoal: text('scene_goal'),
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



export type Simulation = typeof simulations.$inferSelect
export type SimulationTurn = typeof simulationTurns.$inferSelect
export type SimulationScript = typeof simulationScripts.$inferSelect
export type SimulationCharacterState = typeof simulationCharacterStates.$inferSelect
export type ScriptCharacterChunk = typeof scriptCharacterChunks.$inferSelect