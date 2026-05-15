/**
 * Perspective context generation and truncation per spec 15.x and Appendix B.
 *
 * SECURITY: This is part of the hard ACL boundary. Truncation must NEVER
 * leak private/world_only/author_only content to free up tokens.
 */

import { canRead, type AclInfo, type AclTarget, type AclContext } from './acl';

export interface PerspectiveContext {
  identity: Record<string, unknown>;
  current_state: Record<string, unknown>;
  visible_environment: Array<{ text: string; tokens: number }>;
  audible_speech: Array<{ text: string; tokens: number; from_entity_id?: string }>;
  visible_actions: Array<{ text: string; tokens: number; from_entity_id?: string }>;
  observable_clues: Array<{ text: string; tokens: number }>;
  retrieved_memories: Array<{
    id: string;
    content: string;
    importance: number;
    tokens: number;
  }>;
  known_public_facts: Array<{ text: string; tokens: number }>;
  private_self_memories: Array<{ id: string; content: string; tokens: number }>;
  relationship_impressions: Array<{ text: string; tokens: number }>;
  uncertain_inferences: Array<{ text: string; tokens: number }>;
}

export interface FilteredOutSummary {
  private_memories_removed: number;
  world_only_facts_removed: number;
  out_of_range_events_removed: number;
  truncated_by_budget: number;
}

/**
 * Rough token estimator: 1 token ≈ 4 chars (ASCII) / 1.5 chars (CJK).
 * For Chinese-heavy text we use ~1.5 ratio.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjk = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const other = text.length - cjk;
  return Math.ceil(cjk * 1.5 + other / 4);
}

/**
 * Filter a list of memory-like AclInfo records by visibility for the target.
 * Returns the readable subset and counts of removed by reason.
 */
export function aclFilterMemories<T extends AclInfo>(
  memories: T[],
  target: AclTarget,
  ctx: AclContext = {},
): { kept: T[]; removed: { private: number; world_only: number; other: number } } {
  const kept: T[] = [];
  const removed = { private: 0, world_only: 0, other: 0 };
  for (const m of memories) {
    if (canRead(m, target, ctx)) {
      kept.push(m);
    } else {
      if (m.visibility === 'private') removed.private++;
      else if (m.visibility === 'world_only') removed.world_only++;
      else removed.other++;
    }
  }
  return { kept, removed };
}

/**
 * Per Appendix B priority list. Higher priority = kept longer.
 * 1 (highest) - identity, never dropped
 * 2 - current_state
 * 3 - desire core (assumed inside identity for now)
 * 4 - audible_speech latest 10
 * 5 - visible_actions latest 10
 * 6 - retrieved_memories importance > 0.8
 * 7 - relationship_impressions
 * 8 - observable_clues current round
 * 9 - retrieved_memories importance 0.5-0.8
 * 10 - known_public_facts
 * 11 - retrieved_memories importance < 0.5
 * 12 - uncertain_inferences
 * 13 - visible_environment decorative
 */
export function truncateContext(
  ctx: PerspectiveContext,
  tokenBudget: number,
): { context: PerspectiveContext; truncated: number } {
  // Compute current usage
  let used =
    estimateTokens(JSON.stringify(ctx.identity)) +
    estimateTokens(JSON.stringify(ctx.current_state));

  const buckets: Array<{ priority: number; items: Array<{ tokens: number }>; }> = [];

  // Bucket 4: audible_speech latest 10 (others go to bucket 11)
  const speechRecent = ctx.audible_speech.slice(-10);
  const speechRest = ctx.audible_speech.slice(0, Math.max(0, ctx.audible_speech.length - 10));
  buckets.push({ priority: 4, items: speechRecent });
  buckets.push({ priority: 11, items: speechRest });

  // Bucket 5: visible_actions latest 10
  const actionsRecent = ctx.visible_actions.slice(-10);
  const actionsRest = ctx.visible_actions.slice(0, Math.max(0, ctx.visible_actions.length - 10));
  buckets.push({ priority: 5, items: actionsRecent });
  buckets.push({ priority: 11, items: actionsRest });

  // Memory importance buckets
  const memHigh = ctx.retrieved_memories.filter((m) => m.importance > 0.8);
  const memMid = ctx.retrieved_memories.filter((m) => m.importance > 0.5 && m.importance <= 0.8);
  const memLow = ctx.retrieved_memories.filter((m) => m.importance <= 0.5);
  buckets.push({ priority: 6, items: memHigh });
  buckets.push({ priority: 7, items: ctx.relationship_impressions });
  buckets.push({ priority: 8, items: ctx.observable_clues });
  buckets.push({ priority: 9, items: memMid });
  buckets.push({ priority: 10, items: ctx.known_public_facts });
  buckets.push({ priority: 11, items: memLow });
  buckets.push({ priority: 12, items: ctx.uncertain_inferences });
  buckets.push({ priority: 13, items: ctx.visible_environment });

  // Add up by ascending priority (kept)
  buckets.sort((a, b) => a.priority - b.priority);

  const kept = new Set<{ tokens: number }>();
  for (const bucket of buckets) {
    // sort within bucket by .tokens? Spec says by score desc; we keep order
    for (const item of bucket.items) {
      if (used + item.tokens <= tokenBudget) {
        used += item.tokens;
        kept.add(item);
      }
    }
  }

  // Drop non-kept items
  const filterKept = <T extends { tokens: number }>(arr: T[]): T[] =>
    arr.filter((i) => kept.has(i));

  const result: PerspectiveContext = {
    identity: ctx.identity,
    current_state: ctx.current_state,
    visible_environment: filterKept(ctx.visible_environment),
    audible_speech: filterKept(ctx.audible_speech),
    visible_actions: filterKept(ctx.visible_actions),
    observable_clues: filterKept(ctx.observable_clues),
    retrieved_memories: filterKept(ctx.retrieved_memories),
    known_public_facts: filterKept(ctx.known_public_facts),
    private_self_memories: ctx.private_self_memories, // owner's own; not truncated by budget here
    relationship_impressions: filterKept(ctx.relationship_impressions),
    uncertain_inferences: filterKept(ctx.uncertain_inferences),
  };

  // Count truncated items
  const before =
    ctx.visible_environment.length +
    ctx.audible_speech.length +
    ctx.visible_actions.length +
    ctx.observable_clues.length +
    ctx.retrieved_memories.length +
    ctx.known_public_facts.length +
    ctx.relationship_impressions.length +
    ctx.uncertain_inferences.length;
  const after =
    result.visible_environment.length +
    result.audible_speech.length +
    result.visible_actions.length +
    result.observable_clues.length +
    result.retrieved_memories.length +
    result.known_public_facts.length +
    result.relationship_impressions.length +
    result.uncertain_inferences.length;

  return { context: result, truncated: before - after };
}
