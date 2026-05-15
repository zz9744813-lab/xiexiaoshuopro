import { pgTable, uuid, text, timestamp, integer, unique } from 'drizzle-orm/pg-core';
import { worlds } from './worlds';
import { worldlines } from './worldlines';
import { scenes } from './scenes';

/**
 * Per spec 32.9 - simulation rounds within scenes.
 */
export const rounds = pgTable('rounds', {
  id: uuid('id').primaryKey().defaultRandom(),
  sceneId: uuid('scene_id').notNull().references(() => scenes.id),
  worldId: uuid('world_id').notNull().references(() => worlds.id),
  worldlineId: uuid('worldline_id').notNull().references(() => worldlines.id),

  roundIndex: integer('round_index').notNull(),
  mode: text('mode').notNull().default('simultaneous'),
  status: text('status').notNull().default('pending'),

  inputHash: text('input_hash'),
  outputHash: text('output_hash'),
  auditStatus: text('audit_status'),

  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('uq_rounds_scene_index').on(table.sceneId, table.roundIndex),
]);

export const ROUND_MODES = ['sequential', 'simultaneous', 'hybrid_two_phase'] as const;
export const ROUND_STATUSES = [
  'pending', 'running', 'paused', 'committing', 'committed', 'failed', 'rolled_back',
] as const;
