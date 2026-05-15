import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { worlds } from './worlds';

/**
 * Entity table - the unified abstraction for all stateful objects
 * (characters, world_agent, narrator, faction, location, item, director, system)
 * Per spec 9.2 / 32.3
 */
export const entities = pgTable('entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  worldId: uuid('world_id').notNull().references(() => worlds.id),
  entityType: text('entity_type').notNull(), // character | world_agent | narrator | faction | location | item | director | system
  name: text('name').notNull(),
  status: text('status').notNull().default('active'),
  apiProfileId: uuid('api_profile_id'),
  memoryPolicyId: uuid('memory_policy_id'),
  promptVersionId: uuid('prompt_version_id'),
  currentLocationId: uuid('current_location_id'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_entities_world_type').on(table.worldId, table.entityType),
  index('idx_entities_location').on(table.currentLocationId),
  index('idx_entities_status').on(table.status),
]);

export const ENTITY_TYPES = [
  'character',
  'world_agent',
  'narrator',
  'faction',
  'location',
  'item',
  'director',
  'system',
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];
