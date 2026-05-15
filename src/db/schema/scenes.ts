import { pgTable, uuid, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';
import { worlds } from './worlds';
import { worldlines } from './worldlines';

/**
 * Per spec 32.8 - scenes are continuous time-space simulation segments.
 */
export const scenes = pgTable('scenes', {
  id: uuid('id').primaryKey().defaultRandom(),
  worldId: uuid('world_id').notNull().references(() => worlds.id),
  worldlineId: uuid('worldline_id').notNull().references(() => worldlines.id),

  title: text('title'),
  locationId: uuid('location_id'),
  status: text('status').notNull().default('pending'),

  worldTime: jsonb('world_time').notNull(),
  sceneClockMinutes: integer('scene_clock_minutes').notNull().default(0),

  participantEntityIds: uuid('participant_entity_ids').array().notNull().default([]),
  observerEntityIds: uuid('observer_entity_ids').array().notNull().default([]),

  startSnapshotId: uuid('start_snapshot_id'),
  endSnapshotId: uuid('end_snapshot_id'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
});

export const SCENE_STATUSES = [
  'pending', 'running', 'paused', 'completed', 'failed', 'rolled_back',
] as const;
