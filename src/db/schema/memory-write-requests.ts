import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { worlds } from './worlds';
import { worldlines } from './worldlines';

/**
 * Memory write requests - novelizer / external proposals must wait
 * for user approval before being inserted into memories table.
 * Per spec 12.4 / 32.6
 */
export const memoryWriteRequests = pgTable('memory_write_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  worldId: uuid('world_id').notNull().references(() => worlds.id),
  worldlineId: uuid('worldline_id').notNull().references(() => worldlines.id),

  proposedBy: text('proposed_by').notNull(),
  proposedPayload: jsonb('proposed_payload').notNull(),
  sourceTraceId: uuid('source_trace_id'),

  status: text('status').notNull().default('pending'),
  reviewedByUserId: uuid('reviewed_by_user_id'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  appliedMemoryId: uuid('applied_memory_id'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_mwr_world').on(table.worldId, table.status),
]);
