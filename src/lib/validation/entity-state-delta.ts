/**
 * Validation schemas per spec Appendix A.5 - white/blacklist for entity_state_delta fields,
 * used during world agent post-validation (spec Chapter 27).
 */

export const ENTITY_STATE_DELTA_ALLOWED_FIELDS = new Set<string>([
  'current_location_id',
  'status',
  'ability_profile.perception',
  'ability_profile.stealth',
  'ability_profile.social_insight',
  'ability_profile.combat',
  'ability_profile.mobility',
  'desire_profile.current_goal',
  'desire_profile.short_term_goal',
  'metadata.health',
  'metadata.energy',
  'metadata.position_zone',
]);

export const ENTITY_STATE_DELTA_FORBIDDEN_FIELDS = new Set<string>([
  'api_profile_id',
  'memory_policy_id',
  'prompt_version_id',
  'entity_type',
  'owner_user_id',
]);

/** Returns dotted-key list of all leaf paths in an object. */
export function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return prefix ? [prefix] : [];
  }
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flattenKeys(v, key));
    } else {
      out.push(key);
    }
  }
  return out;
}

export interface DeltaValidationResult {
  ok: boolean;
  forbidden: string[];
  unknown: string[];
}

export function validateEntityStateDelta(delta: unknown): DeltaValidationResult {
  const keys = flattenKeys(delta);
  const forbidden: string[] = [];
  const unknown: string[] = [];
  for (const k of keys) {
    if (ENTITY_STATE_DELTA_FORBIDDEN_FIELDS.has(k)) forbidden.push(k);
    else if (!ENTITY_STATE_DELTA_ALLOWED_FIELDS.has(k)) unknown.push(k);
  }
  return { ok: forbidden.length === 0 && unknown.length === 0, forbidden, unknown };
}
