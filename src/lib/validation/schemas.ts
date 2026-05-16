/**
 * Input validation per spec Appendix A.
 * Centralizes string length, JSONB size, numeric range, enum, and array constraints.
 */
import { z } from 'zod';

// A.1 String length limits
export const STR = {
  entityName: z.string().min(1).max(80),
  worldName: z.string().min(1).max(120),
  worldDescription: z.string().max(4000).optional(),
  memoryContent: z.string().min(1).max(4000),
  memorySummary: z.string().max(1000).optional(),
  providerDisplayName: z.string().min(1).max(80),
  baseUrl: z.string().max(500).optional(),
  profileName: z.string().min(1).max(80),
  modelName: z.string().min(1).max(200),
  eventCanonicalSummary: z.string().min(1).max(2000),
  promptContent: z.string().max(100000),
  tag: z.string().max(40),
};

// A.4 Array limits
export const tagsSchema = z.array(STR.tag).max(50);
export const allowedEntitiesSchema = z.array(z.string().uuid()).max(1000);
export const sampleLinesSchema = z.array(z.string().max(500)).max(20);
export const forbiddenPhrasesSchema = z.array(z.string().max(100)).max(50);

// A.3 Numeric ranges
export const confidenceSchema = z.number().min(0).max(1);
export const importanceSchema = z.number().min(0).max(1);
export const emotionalWeightSchema = z.number().min(0).max(1);
export const decayLevelSchema = z.number().min(0).max(1);
export const relationshipDimSchema = z.number().min(-100).max(100);
export const abilityValueSchema = z.number().int().min(0).max(100);
export const temperatureSchema = z.number().min(0).max(2);
export const topPSchema = z.number().min(0).max(1);
export const maxTokensSchema = z.number().int().min(1).max(100000);
export const timeoutSecondsSchema = z.number().int().min(1).max(600);
export const costLimitSchema = z.number().min(0.0001).max(1000);

// A.6 Enums (also exported from schema files)
export const ENTITY_TYPE_ENUM = z.enum([
  'character', 'world_agent', 'narrator', 'faction',
  'location', 'item', 'director', 'system',
]);

export const MEMORY_TYPE_ENUM = z.enum([
  'core_profile', 'episodic', 'inference', 'relationship',
  'emotion_trace', 'plan', 'public_fact', 'canonical_fact',
  'rumor', 'secret', 'system_note', 'summary',
]);

export const VISIBILITY_ENUM = z.enum([
  'private', 'self_and_world', 'public', 'shared', 'faction',
  'location_public', 'world_only', 'author_only', 'novelizer_only', 'acl',
]);

export const TRUTH_STATUS_ENUM = z.enum([
  'true', 'false', 'unknown', 'subjective', 'rumor', 'inference', 'contradicted',
]);

export const PROPOSED_BY_ENUM = z.enum([
  'character_self', 'world_resolved', 'director', 'novelizer', 'user_manual', 'system_note',
]);

export const APPROVAL_STATUS_ENUM = z.enum([
  'auto_approved', 'pending_user_approval', 'approved', 'rejected',
]);

export const EVENT_LEVEL_ENUM = z.enum(['ordinary', 'meaningful', 'major', 'extreme']);

export const ROUND_MODE_ENUM = z.enum(['sequential', 'simultaneous', 'hybrid_two_phase']);

export const ACTION_PHASE_ENUM = z.enum(['single', 'intent', 'public', 'reaction']);

// A.2 JSONB size check helper
export function jsonbSize(obj: unknown): number {
  return Buffer.byteLength(JSON.stringify(obj), 'utf8');
}

export function jsonbSizeAtMost(obj: unknown, maxBytes: number): boolean {
  return jsonbSize(obj) <= maxBytes;
}

// A.4 nesting depth (max 6)
export function jsonDepth(obj: unknown, current = 0): number {
  if (current > 100) return current; // safety
  if (obj === null || typeof obj !== 'object') return current;
  if (Array.isArray(obj)) {
    return obj.reduce<number>(
      (max, v) => Math.max(max, jsonDepth(v, current + 1)),
      current + 1,
    );
  }
  return Object.values(obj as Record<string, unknown>).reduce<number>(
    (max, v) => Math.max(max, jsonDepth(v, current + 1)),
    current + 1,
  );
}

export function jsonDepthAtMost(obj: unknown, maxDepth: number): boolean {
  return jsonDepth(obj) <= maxDepth;
}

// ---------- High-level composed schemas ----------

/** spec § 5.2 - world_time structure */
export const worldTimeSchema = z.object({
  world_day: z.number().int().min(0),
  time_block: z.string().max(20).optional(),
  scene_clock_minutes: z.number().int().min(0).max(60 * 24 * 365).optional(),
});

/** spec § 10.1 character profile fields */
export const speechStyleSchema = z.object({
  sentence_length: z.string().max(40).optional(),
  traits: z.array(z.string().max(100)).max(20).optional(),
  forbidden_style: z.array(z.string().max(80)).max(20).optional(),
  forbidden_phrases: forbiddenPhrasesSchema.optional(),
  sample_lines: sampleLinesSchema.optional(),
});

export const expressionProfileSchema = z.record(
  z.string().max(40),
  z.array(z.string().max(200)).max(20),
);

export const desireProfileSchema = z.object({
  core_desire: z.string().max(500).optional(),
  fears: z.array(z.string().max(200)).max(20).optional(),
  long_term_goal: z.string().max(500).optional(),
  short_term_goal: z.string().max(500).optional(),
  current_goal: z.string().max(500).optional(),
});

export const abilityProfileSchema = z.object({
  perception: abilityValueSchema.optional(),
  stealth: abilityValueSchema.optional(),
  social_insight: abilityValueSchema.optional(),
  combat: abilityValueSchema.optional(),
  mobility: abilityValueSchema.optional(),
});

export const relationshipDimsSchema = z.object({
  trust: relationshipDimSchema.optional(),
  suspicion: relationshipDimSchema.optional(),
  attraction: relationshipDimSchema.optional(),
  fear: relationshipDimSchema.optional(),
  guilt: relationshipDimSchema.optional(),
  dependence: relationshipDimSchema.optional(),
  curiosity: relationshipDimSchema.optional(),
  hostility: relationshipDimSchema.optional(),
  protectiveness: relationshipDimSchema.optional(),
  control_desire: relationshipDimSchema.optional(),
});
