import { pgTable, uuid, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { worlds } from './worlds';
import { apiProviders } from './api-providers';

/**
 * Per spec 32.18 - embedding profile bound to a world.
 * Each world uses exactly one embedding model; switching requires re-embedding.
 */
export const embeddingProfiles = pgTable('embedding_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull(),
  worldId: uuid('world_id').references(() => worlds.id),
  providerId: uuid('provider_id').references(() => apiProviders.id),
  name: text('name').notNull(),
  model: text('model').notNull(),
  dimension: integer('dimension').notNull(),
  distanceMetric: text('distance_metric').notNull().default('cosine'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_embedding_profiles_world').on(table.worldId),
]);
