import { pgTable, uuid, text, timestamp, jsonb, integer, numeric, index } from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-orm/pg-core';
import { worlds } from './worlds';
import { worldlines } from './worldlines';
import { entities } from './entities';

/**
 * Memories - core ACL-bearing structured memory records.
 * Per spec 12.x / 13.x / 14.x / 32.5
 *
 * NOTE: embedding dimension is fixed to 1536 here for the default OpenAI
 * text-embedding-3-small profile. Per spec 32.5, when a world uses a
 * different embedding model, DDL must be regenerated for that dimension
 * (or stored via dynamic vector columns / per-world tables).
 */
export const memories = pgTable('memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  worldId: uuid('world_id').notNull().references(() => worlds.id),
  worldlineId: uuid('worldline_id').notNull().references(() => worldlines.id),
  ownerEntityId: uuid('owner_entity_id').notNull().references(() => entities.id),

  memoryType: text('memory_type').notNull(),
  content: text('content').notNull(),
  summary: text('summary'),

  // ACL
  visibility: text('visibility').notNull().default('private'),
  allowedEntities: uuid('allowed_entities').array().notNull().default([]),
  deniedEntities: uuid('denied_entities').array().notNull().default([]),
  allowedFactions: uuid('allowed_factions').array().notNull().default([]),

  // Truth / quality
  truthStatus: text('truth_status').notNull().default('subjective'),
  confidence: numeric('confidence', { precision: 4, scale: 3 }).notNull().default('1.000'),
  importance: numeric('importance', { precision: 4, scale: 3 }).notNull().default('0.500'),
  emotionalWeight: numeric('emotional_weight', { precision: 4, scale: 3 }).notNull().default('0.000'),
  decayLevel: numeric('decay_level', { precision: 4, scale: 3 }).notNull().default('0.000'),
  reinforcementCount: integer('reinforcement_count').notNull().default(0),

  // Approval (spec 12.4)
  proposedBy: text('proposed_by').notNull().default('character_self'),
  approvalStatus: text('approval_status').notNull().default('auto_approved'),
  approvalUserId: uuid('approval_user_id'),
  approvalAt: timestamp('approval_at', { withTimezone: true }),

  // Source linkage
  sourceEventId: uuid('source_event_id'),
  sourceActionId: uuid('source_action_id'),
  sourceMemoryId: uuid('source_memory_id'),

  tags: text('tags').array().notNull().default([]),
  embedding: vector('embedding', { dimensions: 1536 }),

  validFromWorldTime: jsonb('valid_from_world_time'),
  validToWorldTime: jsonb('valid_to_world_time'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_memories_owner').on(table.ownerEntityId),
  index('idx_memories_worldline').on(table.worldlineId),
  index('idx_memories_type').on(table.memoryType),
  index('idx_memories_visibility').on(table.visibility),
  index('idx_memories_approval').on(table.approvalStatus),
]);

export const MEMORY_TYPES = [
  'core_profile',
  'episodic',
  'inference',
  'relationship',
  'emotion_trace',
  'plan',
  'public_fact',
  'canonical_fact',
  'rumor',
  'secret',
  'system_note',
  'summary',
] as const;

export const VISIBILITY_TYPES = [
  'private',
  'self_and_world',
  'public',
  'shared',
  'faction',
  'location_public',
  'world_only',
  'author_only',
  'novelizer_only',
  'acl',
] as const;

export const TRUTH_STATUSES = [
  'true',
  'false',
  'unknown',
  'subjective',
  'rumor',
  'inference',
  'contradicted',
] as const;

export const PROPOSED_BY = [
  'character_self',
  'world_resolved',
  'director',
  'novelizer',
  'user_manual',
  'system_note',
] as const;

export const APPROVAL_STATUSES = [
  'auto_approved',
  'pending_user_approval',
  'approved',
  'rejected',
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];
export type Visibility = (typeof VISIBILITY_TYPES)[number];
export type TruthStatus = (typeof TRUTH_STATUSES)[number];
export type ProposedBy = (typeof PROPOSED_BY)[number];
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
