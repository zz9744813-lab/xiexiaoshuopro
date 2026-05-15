import { pgTable, uuid, text, timestamp, jsonb, integer, boolean } from 'drizzle-orm/pg-core';

/**
 * Per spec 32.13 - LLM API providers (OpenAI / Anthropic / etc).
 */
export const apiProviders = pgTable('api_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull(),
  providerType: text('provider_type').notNull(),
  displayName: text('display_name').notNull(),
  baseUrl: text('base_url'),
  apiKeySecretId: uuid('api_key_secret_id'),
  isOpenaiCompatible: boolean('is_openai_compatible').notNull().default(false),
  rateLimitPerMinute: integer('rate_limit_per_minute'),
  maxConcurrentCalls: integer('max_concurrent_calls').notNull().default(5),
  status: text('status').notNull().default('active'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const PROVIDER_TYPES = [
  'openai',
  'anthropic',
  'gemini',
  'deepseek',
  'mistral',
  'openrouter',
  'ollama',
  'openai_compatible',
] as const;
