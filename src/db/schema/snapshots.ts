import { pgTable, uuid, text, timestamp, jsonb, bigint, index } from 'drizzle-orm/pg-core';
import { worlds } from './worlds';
import { worldlines } from './worldlines';

/**
 * Per spec 32.16 - snapshots taken at scene_start / scene_end /
 * worldline_fork / user_checkpoint (NOT per round; round rollback uses tx).
 */
export const snapshots = pgTable('snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  worldId: uuid('world_id').notNull().references(() => worlds.id),
  worldlineId: uuid('worldline_id').notNull().references(() => worldlines.id),

  snapshotType: text('snapshot_type').notNull(),
  sceneId: uuid('scene_id'),
  roundId: uuid('round_id'),

  stateBlob: jsonb('state_blob').notNull(),
  stateHash: text('state_hash').notNull(),
  parentSnapshotId: uuid('parent_snapshot_id'),

  sizeBytes: bigint('size_bytes', { mode: 'number' }).default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_snapshots_worldline').on(table.worldlineId),
]);

export const SNAPSHOT_TYPES = [
  'scene_start', 'scene_end', 'worldline_fork', 'user_checkpoint',
] as const;
