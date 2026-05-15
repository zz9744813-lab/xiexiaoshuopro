import { pgTable, uuid, text, timestamp, jsonb, integer, numeric } from 'drizzle-orm/pg-core';
import { apiProviders } from './api-providers';

/**
 * Per spec 32.14 - API profiles bind a provider+model+params.
 */
export const apiProfiles = pgTable('api_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerId: uuid('provider_id').notNull().references(() => apiProviders.id),
  ownerUserId: uuid('owner_user_id').notNull(),

  name: text('name').notNull(),
  model: text('model').notNull(),

  temperature: numeric('temperature', { precision: 4, scale: 3 }),
  topP: numeric('top_p', { precision: 4, scale: 3 }),
  maxTokens: integer('max_tokens'),
  responseFormat: text('response_format').default('json'),
  timeoutSeconds: integer('timeout_seconds').notNull().default(60),
  retryCount: integer('retry_count').notNull().default(2),
  fallbackApiProfileId: uuid('fallback_api_profile_id'),

  costLimitPerCall: numeric('cost_limit_per_call', { precision: 10, scale: 4 }),
  costLimitPerRun: numeric('cost_limit_per_run', { precision: 10, scale: 4 }),
  costLimitPerDay: numeric('cost_limit_per_day', { precision: 10, scale: 4 }),

  metadata: jsonb('metadata').notNull().default({}),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
