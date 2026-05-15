import { pgTable, uuid, text, timestamp, jsonb, boolean, index, AnyPgColumn } from 'drizzle-orm/pg-core';
import { rounds } from './rounds';
import { scenes } from './scenes';
import { entities } from './entities';

/**
 * Per spec 32.10 - actions are character outputs in rounds.
 * phase + parent_action_id support hybrid_two_phase mode (spec 19.4).
 */
export const actions = pgTable('actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  roundId: uuid('round_id').notNull().references(() => rounds.id),
  sceneId: uuid('scene_id').notNull().references(() => scenes.id),
  entityId: uuid('entity_id').notNull().references(() => entities.id),

  phase: text('phase').notNull().default('single'),
  parentActionId: uuid('parent_action_id').references((): AnyPgColumn => actions.id),

  actionType: text('action_type').notNull(),
  actionIntent: jsonb('action_intent').notNull().default({}),
  publicLayer: jsonb('public_layer').notNull().default({}),
  privateLayer: jsonb('private_layer').notNull().default({}),
  memoryUpdate: jsonb('memory_update').notNull().default({}),

  rawModelOutput: jsonb('raw_model_output'),
  isFallback: boolean('is_fallback').notNull().default(false),
  wasInterrupted: boolean('was_interrupted').notNull().default(false),
  status: text('status').notNull().default('pending'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_actions_round').on(table.roundId),
  index('idx_actions_entity').on(table.entityId),
  index('idx_actions_parent').on(table.parentActionId),
]);

export const ACTION_PHASES = ['single', 'intent', 'public', 'reaction'] as const;
export const ACTION_TYPES = [
  'speak_only',
  'act_only',
  'speak_and_act',
  'observe',
  'move',
  'wait',
  'hide',
  'attack',
  'use_item',
  'thinking_only',
  'system_default',
] as const;
