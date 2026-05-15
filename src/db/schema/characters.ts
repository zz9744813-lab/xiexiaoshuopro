import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { entities } from './entities';

/**
 * Character profile - extends entity with character-specific fields
 * Per spec 10.1 / 32.4
 */
export const characters = pgTable('characters', {
  entityId: uuid('entity_id').primaryKey().references(() => entities.id),
  publicProfile: jsonb('public_profile').notNull().default({}),
  privateProfile: jsonb('private_profile').notNull().default({}),
  speechStyle: jsonb('speech_style').notNull().default({}),
  expressionProfile: jsonb('expression_profile').notNull().default({}),
  desireProfile: jsonb('desire_profile').notNull().default({}),
  abilityProfile: jsonb('ability_profile').notNull().default({}),
  initialPrompt: text('initial_prompt'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
