import { pgTable, uuid, text, timestamp, jsonb, integer, numeric, index } from 'drizzle-orm/pg-core';
import { worlds } from './worlds';
import { worldlines } from './worldlines';

/**
 * Per spec 32.15 - full LLM call observability records.
 */
export const simulationTraces = pgTable('simulation_traces', {
  id: uuid('id').primaryKey().defaultRandom(),
  worldId: uuid('world_id').notNull().references(() => worlds.id),
  worldlineId: uuid('worldline_id').notNull().references(() => worldlines.id),
  sceneId: uuid('scene_id'),
  roundId: uuid('round_id'),
  entityId: uuid('entity_id'),
  actionId: uuid('action_id'),

  traceType: text('trace_type').notNull(),
  phase: text('phase'),
  promptVersionId: uuid('prompt_version_id'),
  apiProfileId: uuid('api_profile_id'),

  inputContext: jsonb('input_context'),
  promptMessages: jsonb('prompt_messages'),
  rawOutput: jsonb('raw_output'),
  parsedOutput: jsonb('parsed_output'),
  filteredOutput: jsonb('filtered_output'),

  tokenInput: integer('token_input'),
  tokenOutput: integer('token_output'),
  costEstimate: numeric('cost_estimate', { precision: 10, scale: 6 }),
  latencyMs: integer('latency_ms'),

  status: text('status').notNull(),
  errorMessage: text('error_message'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_traces_round').on(table.roundId),
  index('idx_traces_entity').on(table.entityId),
  index('idx_traces_type').on(table.traceType),
]);

export const TRACE_TYPES = [
  'context_router',
  'character_call',
  'world_agent_call',
  'novelizer_call',
  'audit',
  'memory_retrieval',
  'replay',
] as const;
