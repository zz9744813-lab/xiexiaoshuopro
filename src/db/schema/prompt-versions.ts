import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { worlds } from './worlds';

/**
 * Per spec 32.17 - prompt versioning (character_system, world_agent_system,
 * narrator, audit_checker, json_repair, etc).
 * world_id can be null = global template.
 */
export const promptVersions = pgTable('prompt_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id'),
  worldId: uuid('world_id').references(() => worlds.id),
  name: text('name').notNull(),
  promptType: text('prompt_type').notNull(),
  version: text('version').notNull(),
  content: text('content').notNull(),
  variables: jsonb('variables').notNull().default({}),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_prompt_versions_world').on(table.worldId, table.promptType),
]);

export const PROMPT_TYPES = [
  'character_system',
  'world_agent_system',
  'context_router_template',
  'novelizer_system',
  'memory_summarizer',
  'audit_checker',
  'json_repair',
  'drift_detector',
] as const;
