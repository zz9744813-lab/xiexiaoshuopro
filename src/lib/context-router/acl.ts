/**
 * ACL evaluation per spec 13.5.
 *
 * SECURITY CRITICAL: This is the code-layer hard boundary.
 * LLMs must NEVER be the security boundary - this function is.
 */

export interface AclInfo {
  owner_entity_id: string;
  visibility:
    | 'private'
    | 'self_and_world'
    | 'public'
    | 'shared'
    | 'faction'
    | 'location_public'
    | 'world_only'
    | 'author_only'
    | 'novelizer_only'
    | 'acl';
  allowed_entities?: string[] | null;
  denied_entities?: string[] | null;
  allowed_factions?: string[] | null;
  location_id?: string | null;
  source_layer?: 'private_layer' | 'public_layer' | 'observable_clue' | string | null;
}

export interface AclTarget {
  entityId: string;
  entityType:
    | 'character'
    | 'world_agent'
    | 'narrator'
    | 'faction'
    | 'location'
    | 'item'
    | 'director'
    | 'system';
}

export interface AclContext {
  /** Must be injected by backend after auth. Frontend MUST NOT set this. */
  isAuthorView?: boolean;
  /** For faction visibility */
  targetFactions?: string[];
  /** For location_public visibility */
  targetLocationIds?: string[];
}

/**
 * Per spec 13.5 - canRead evaluates whether `target` can read `info`.
 *
 * Order:
 * 1. owner always reads (denied does not apply to owner)
 * 2. narrator special-case (sees private/world_only/etc but NOT author_only)
 * 3. is_author_view bypasses everything
 * 4. denied_entities blocks
 * 5. visibility-specific checks
 * 6. private_layer fallback denies
 */
export function canRead(info: AclInfo, target: AclTarget, ctx: AclContext = {}): boolean {
  // 1. owner > denied
  if (info.owner_entity_id === target.entityId) return true;

  // 2. narrator special-case (spec 13.4)
  if (target.entityType === 'narrator') {
    if (info.visibility === 'author_only') return false;
    return true;
  }

  // 3. author view bypass
  if (ctx.isAuthorView === true) return true;

  // 4. denied list
  if (info.denied_entities?.includes(target.entityId)) return false;

  // private_layer source is never readable except via above paths (spec 13.3.10)
  if (info.source_layer === 'private_layer') return false;

  switch (info.visibility) {
    case 'public':
      return true;
    case 'shared':
      return Boolean(info.allowed_entities?.includes(target.entityId));
    case 'faction':
      return Boolean(
        info.allowed_factions?.some((f) => ctx.targetFactions?.includes(f)),
      );
    case 'location_public':
      return Boolean(
        info.location_id && ctx.targetLocationIds?.includes(info.location_id),
      );
    case 'self_and_world':
      // owner already passed; only world_agent can read
      return target.entityType === 'world_agent';
    case 'world_only':
      return target.entityType === 'world_agent';
    case 'author_only':
    case 'novelizer_only':
    case 'private':
    case 'acl':
      // For 'acl', allowed_entities check would have been the gate; leftover means blocked.
      if (info.visibility === 'acl') {
        return Boolean(info.allowed_entities?.includes(target.entityId));
      }
      return false;
    default:
      return false;
  }
}

/** Convenience: filter array of items by ACL */
export function filterByAcl<T extends AclInfo>(
  items: T[],
  target: AclTarget,
  ctx: AclContext = {},
): T[] {
  return items.filter((it) => canRead(it, target, ctx));
}
