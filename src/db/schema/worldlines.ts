import { pgTable, uuid, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { worlds } from './worlds';

export const worldlines = pgTable('worldlines', {
  id: uuid('id').primaryKey().defaultRandom(),
  worldId: uuid('world_id').notNull().references(() => worlds.id),
  parentWorldlineId: uuid('parent_worldline_id'),
  name: text('name').notNull(),
  branchReason: text('branch_reason'),
  branchFromSnapshotId: uuid('branch_from_snapshot_id'),
  status: text('status').notNull().default('active'),
  // lineage_path/depth pre-reserved for future CoW (spec 23.2)
  lineageDepth: integer('lineage_depth').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_worldlines_world').on(table.worldId),
  index('idx_worldlines_parent').on(table.parentWorldlineId),
]);
