import { pgTable, uuid, text, timestamp, numeric, unique, index } from 'drizzle-orm/pg-core';
import { worlds } from './worlds';
import { worldlines } from './worldlines';
import { entities } from './entities';

/**
 * Per spec 32.7 - relationships between entities, multi-dimensional.
 * 0-100 default range; relationship deltas constrained per spec 27.2.
 */
export const relationships = pgTable('relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  worldId: uuid('world_id').notNull().references(() => worlds.id),
  worldlineId: uuid('worldline_id').notNull().references(() => worldlines.id),
  sourceEntityId: uuid('source_entity_id').notNull().references(() => entities.id),
  targetEntityId: uuid('target_entity_id').notNull().references(() => entities.id),

  trust: numeric('trust', { precision: 5, scale: 2 }).notNull().default('0'),
  suspicion: numeric('suspicion', { precision: 5, scale: 2 }).notNull().default('0'),
  attraction: numeric('attraction', { precision: 5, scale: 2 }).notNull().default('0'),
  fear: numeric('fear', { precision: 5, scale: 2 }).notNull().default('0'),
  guilt: numeric('guilt', { precision: 5, scale: 2 }).notNull().default('0'),
  dependence: numeric('dependence', { precision: 5, scale: 2 }).notNull().default('0'),
  curiosity: numeric('curiosity', { precision: 5, scale: 2 }).notNull().default('0'),
  hostility: numeric('hostility', { precision: 5, scale: 2 }).notNull().default('0'),
  protectiveness: numeric('protectiveness', { precision: 5, scale: 2 }).notNull().default('0'),
  controlDesire: numeric('control_desire', { precision: 5, scale: 2 }).notNull().default('0'),

  notes: text('notes'),
  lastEventId: uuid('last_event_id'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('uq_rel_worldline_pair').on(table.worldlineId, table.sourceEntityId, table.targetEntityId),
  index('idx_relationships_source').on(table.sourceEntityId),
  index('idx_relationships_target').on(table.targetEntityId),
  index('idx_relationships_worldline').on(table.worldlineId),
]);

export const RELATIONSHIP_DIMS = [
  'trust', 'suspicion', 'attraction', 'fear', 'guilt',
  'dependence', 'curiosity', 'hostility', 'protectiveness', 'control_desire',
] as const;
