import { pgTable, uuid, text, timestamp, jsonb, numeric } from 'drizzle-orm/pg-core';
import { worlds } from './worlds';
import { worldlines } from './worldlines';
import { scenes } from './scenes';
import { rounds } from './rounds';

/**
 * Per spec 32.11 - canonical events recorded by the world agent.
 */
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  worldId: uuid('world_id').notNull().references(() => worlds.id),
  worldlineId: uuid('worldline_id').notNull().references(() => worldlines.id),
  sceneId: uuid('scene_id').references(() => scenes.id),
  roundId: uuid('round_id').references(() => rounds.id),

  eventType: text('event_type').notNull(),
  title: text('title'),
  canonicalSummary: text('canonical_summary').notNull(),
  publicSummary: text('public_summary'),
  hiddenSummary: text('hidden_summary'),

  involvedEntityIds: uuid('involved_entity_ids').array().notNull().default([]),
  locationId: uuid('location_id'),
  worldTime: jsonb('world_time').notNull(),

  sourceActionIds: uuid('source_action_ids').array().notNull().default([]),
  importance: numeric('importance', { precision: 4, scale: 3 }).notNull().default('0.500'),
  eventLevel: text('event_level').notNull().default('ordinary'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const EVENT_LEVELS = ['ordinary', 'meaningful', 'major', 'extreme'] as const;
