import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { worlds } from './worlds';

/**
 * Per spec 32.19 - audit log for safety/permission/quality findings.
 */
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  worldId: uuid('world_id').notNull().references(() => worlds.id),
  worldlineId: uuid('worldline_id'),
  roundId: uuid('round_id'),
  sceneId: uuid('scene_id'),

  auditType: text('audit_type').notNull(),
  severity: text('severity').notNull(),
  source: text('source'),
  target: text('target'),
  description: text('description'),
  actionTaken: text('action_taken'),

  payload: jsonb('payload'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_audit_world_severity').on(table.worldId, table.severity),
]);

export const AUDIT_SEVERITIES = ['info', 'warning', 'error', 'critical'] as const;
