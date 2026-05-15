/**
 * Context Router - generates per-entity perspective context.
 * Per spec 15.x.
 *
 * SECURITY CRITICAL: Every memory/event/action passing into a character's
 * prompt MUST go through canRead(). NEVER pass raw DB rows.
 */

import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import {
  memories as memoriesTable,
  entities as entitiesTable,
  characters as charactersTable,
} from '@/db/schema';
import { canRead, type AclTarget, type AclContext, type AclInfo } from './acl';
import {
  truncateContext,
  estimateTokens,
  type PerspectiveContext,
} from './perspective';

export interface RouterInputs {
  worldId: string;
  worldlineId: string;
  sceneId: string;
  roundId: string;
  targetEntityId: string;
  /** Public-layer outputs from the previous round (already public) */
  publicSceneLog?: Array<{
    fromEntityId?: string;
    spoken_text?: string;
    visible_action?: string;
    observable_clues?: string[];
    locationId?: string;
  }>;
  /** Token budget per spec App B.2 */
  tokenBudget?: number;
}

export interface RouterOutput {
  targetEntityId: string;
  perspectiveContext: PerspectiveContext;
  filteredOutSummary: {
    private_memories_removed: number;
    world_only_facts_removed: number;
    out_of_range_events_removed: number;
    truncated_by_budget: number;
  };
}

/**
 * Default token budgets per Appendix B.2.
 */
function defaultBudget(entityType: string): number {
  switch (entityType) {
    case 'world_agent':
      return 24000;
    case 'narrator':
      return 64000;
    case 'character':
      return Number(process.env.MAX_CONTEXT_TOKENS ?? 12000);
    default:
      return 8000;
  }
}

/**
 * Generate perspective context for one target entity.
 * MVP version: covers identity / memories (ACL-filtered) / public scene log.
 */
export async function generatePerspectiveContext(
  inputs: RouterInputs,
): Promise<RouterOutput> {
  const [target] = await db
    .select()
    .from(entitiesTable)
    .where(eq(entitiesTable.id, inputs.targetEntityId));
  if (!target) {
    throw new Error(`Target entity ${inputs.targetEntityId} not found`);
  }

  const aclTarget: AclTarget = {
    entityId: target.id,
    entityType: target.entityType as AclTarget['entityType'],
  };
  // For MVP, single-user backend always sets isAuthorView=false for in-simulation
  // context (the simulation engine impersonates the entity, not the author).
  const aclCtx: AclContext = { isAuthorView: false };

  // Identity
  let identity: Record<string, unknown> = {
    entity_id: target.id,
    entity_type: target.entityType,
    name: target.name,
  };
  if (target.entityType === 'character') {
    const [charRow] = await db
      .select()
      .from(charactersTable)
      .where(eq(charactersTable.entityId, target.id));
    if (charRow) {
      identity = {
        ...identity,
        public_profile: charRow.publicProfile,
        speech_style: charRow.speechStyle,
        // private_profile, expression_profile etc are owner-private; OK to include
        // because this context is for the OWNER themselves (their own memories include private).
        private_profile: charRow.privateProfile,
        expression_profile: charRow.expressionProfile,
        desire_profile: charRow.desireProfile,
        ability_profile: charRow.abilityProfile,
      };
    }
  }

  // Memories: load all memories owned by target OR potentially shared with target.
  // We load broadly then ACL-filter.
  const candidateMemories = await db
    .select()
    .from(memoriesTable)
    .where(
      and(
        eq(memoriesTable.worldId, inputs.worldId),
        eq(memoriesTable.worldlineId, inputs.worldlineId),
      ),
    );

  // Map to AclInfo shape (the fields canRead needs)
  const aclMems = candidateMemories.map((m) => {
    const info: AclInfo & {
      _row: typeof m;
    } = {
      owner_entity_id: m.ownerEntityId,
      visibility: m.visibility as AclInfo['visibility'],
      allowed_entities: m.allowedEntities ?? [],
      denied_entities: m.deniedEntities ?? [],
      allowed_factions: m.allowedFactions ?? [],
      _row: m,
    };
    return info;
  });

  let privateRemoved = 0;
  let worldOnlyRemoved = 0;
  const readableMems: typeof candidateMemories = [];
  for (const am of aclMems) {
    if (canRead(am, aclTarget, aclCtx)) {
      readableMems.push(am._row);
    } else {
      if (am.visibility === 'private') privateRemoved++;
      else if (am.visibility === 'world_only') worldOnlyRemoved++;
    }
  }

  // Split: owner's own private memories vs retrieved from others
  const ownPrivate = readableMems.filter((m) => m.ownerEntityId === target.id);
  const otherReadable = readableMems.filter((m) => m.ownerEntityId !== target.id);

  const perspectiveContext: PerspectiveContext = {
    identity,
    current_state: {
      current_location_id: target.currentLocationId,
      status: target.status,
    },
    visible_environment: [],
    audible_speech: (inputs.publicSceneLog ?? [])
      .filter((l) => l.spoken_text)
      .map((l) => ({
        text: l.spoken_text!,
        tokens: estimateTokens(l.spoken_text!),
        from_entity_id: l.fromEntityId,
      })),
    visible_actions: (inputs.publicSceneLog ?? [])
      .filter((l) => l.visible_action)
      .map((l) => ({
        text: l.visible_action!,
        tokens: estimateTokens(l.visible_action!),
        from_entity_id: l.fromEntityId,
      })),
    observable_clues: (inputs.publicSceneLog ?? [])
      .flatMap((l) => l.observable_clues ?? [])
      .map((c) => ({ text: c, tokens: estimateTokens(c) })),
    retrieved_memories: otherReadable.map((m) => ({
      id: m.id,
      content: m.content,
      importance: Number(m.importance),
      tokens: estimateTokens(m.content),
    })),
    known_public_facts: [],
    private_self_memories: ownPrivate.map((m) => ({
      id: m.id,
      content: m.content,
      tokens: estimateTokens(m.content),
    })),
    relationship_impressions: [],
    uncertain_inferences: [],
  };

  const budget = inputs.tokenBudget ?? defaultBudget(target.entityType);
  const { context, truncated } = truncateContext(perspectiveContext, budget);

  return {
    targetEntityId: target.id,
    perspectiveContext: context,
    filteredOutSummary: {
      private_memories_removed: privateRemoved,
      world_only_facts_removed: worldOnlyRemoved,
      out_of_range_events_removed: 0,
      truncated_by_budget: truncated,
    },
  };
}
