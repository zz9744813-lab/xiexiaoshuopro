import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { events } from './events';

/**
 * Per spec 32.12 - per-event detailed logs with their own ACL.
 */
export const eventLogs = pgTable('event_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id),
  logType: text('log_type').notNull(),

  content: jsonb('content').notNull(),
  visibility: text('visibility').notNull().default('world_only'),
  allowedEntities: uuid('allowed_entities').array().notNull().default([]),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
