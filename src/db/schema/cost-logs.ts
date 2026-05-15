import { pgTable, uuid, text, timestamp, integer, numeric, index } from 'drizzle-orm/pg-core';
import { worlds } from './worlds';

/**
 * Per spec 32.20 - per-call cost ledger.
 */
export const costLogs = pgTable('cost_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  worldId: uuid('world_id').notNull().references(() => worlds.id),
  worldlineId: uuid('worldline_id'),
  roundId: uuid('round_id'),
  sceneId: uuid('scene_id'),
  entityId: uuid('entity_id'),
  apiProfileId: uuid('api_profile_id'),
  traceId: uuid('trace_id'),

  costUsd: numeric('cost_usd', { precision: 10, scale: 6 }).notNull().default('0'),
  tokenInput: integer('token_input'),
  tokenOutput: integer('token_output'),
  phase: text('phase'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_cost_world_day').on(table.worldId, table.createdAt),
  index('idx_cost_round').on(table.roundId),
]);
