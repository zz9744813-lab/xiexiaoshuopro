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
import { characterTierEnum } from './enums'

// ============ Character 模块 ============

export const characters = pgTable('characters', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  tier: characterTierEnum('tier').default('walk_on'),
  appearance: text('appearance'),
  publicRole: text('public_role'),
  voiceMd: text('voice_md'),
  embedding: vector('embedding'),
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
  embedding: vector('embedding'),
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

export const relationshipDirectionEnum = pgEnum('relationship_direction', ['asymmetric', 'symmetric'])

export const characterRelationships = pgTable('character_relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterA: uuid('character_a').references(() => characters.id, { onDelete: 'cascade' }).notNull(),
  characterB: uuid('character_b').references(() => characters.id, { onDelete: 'cascade' }).notNull(),
  relationType: text('relation_type'), // family|romantic|hostile|mentor|...
  warmth: integer('warmth'), // -100..100
  trust: integer('trust'),
  admiration: integer('admiration'),
  fear: integer('fear'),
  desire: integer('desire'),
  respect: integer('respect'),
  jealousy: integer('jealousy'),
  dependency: integer('dependency'),
  obligation: integer('obligation'),
  secrecy: integer('secrecy'), // 0..100
  historyMd: text('history_md'),
  lastUpdatedChapterId: uuid('last_updated_chapter_id'),
  direction: relationshipDirectionEnum('direction').default('symmetric'),
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



export type Character = typeof characters.$inferSelect
export type CharacterTier = typeof characterTierEnum.$inferSelect
export type CharacterRelationship = typeof characterRelationships.$inferSelect
export type CharacterAppearance = typeof characterAppearances.$inferSelect
export type CharacterVoiceAnchor = typeof characterVoiceAnchors.$inferSelect