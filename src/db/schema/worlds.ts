import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const worlds = pgTable('worlds', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  genre: text('genre'),
  ownerUserId: uuid('owner_user_id').notNull(),

  defaultWorldlineId: uuid('default_worldline_id'),
  defaultEmbeddingProfileId: uuid('default_embedding_profile_id'),
  defaultCharacterPromptVersionId: uuid('default_character_prompt_version_id'),
  worldAgentPromptVersionId: uuid('world_agent_prompt_version_id'),
  novelizerPromptVersionId: uuid('novelizer_prompt_version_id'),

  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_worlds_owner').on(table.ownerUserId),
]);
