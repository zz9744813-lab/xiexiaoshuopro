/**
 * Memory decay/retrieval scoring per spec 14.x.
 */

import type { MemoryType } from '@/db/schema/memories';

const DECAY_RATE_BY_TYPE: Record<string, number> = {
  core_profile: 0,
  secret: 0.003,
  plan: 0.015,
  relationship: 0.012,
  episodic: 0.05,
  inference: 0.06,
  public_fact: 0.025,
  emotion_trace: 0.02,
  rumor: 0.08,
  system_note: 0.1,
  summary: 0.01,
  canonical_fact: 0,
};

export function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Spec 14.2 decay formula.
 */
export function computeDecayLevel(args: {
  memoryType: MemoryType | string;
  createdWorldDay: number;
  currentWorldDay: number;
  importance: number;
  emotionalWeight: number;
  reinforcementCount: number;
  truthStatus?: string;
}): number {
  const decayRate = DECAY_RATE_BY_TYPE[args.memoryType] ?? 0.05;
  const days = Math.max(0, args.currentWorldDay - args.createdWorldDay);
  let baseDecay = days * decayRate;
  // emotional_weight > 0.8 halves decay
  if (args.emotionalWeight > 0.8) baseDecay *= 0.5;
  const raw =
    baseDecay / (args.importance + args.emotionalWeight + 0.2) -
    args.reinforcementCount * 0.05;
  let decay = clamp(0, 1, raw);
  // importance > 0.9 caps at 0.3 unless contradicted
  if (args.importance > 0.9 && args.truthStatus !== 'contradicted') {
    decay = Math.min(decay, 0.3);
  }
  return decay;
}

export interface MemoryScoringInputs {
  semanticSimilarity: number; // 0-1
  importance: number;
  emotionalWeight: number;
  recencyScore: number; // 0-1
  goalRelevance: number; // 0-1
  relationshipRelevance: number; // 0-1
  decayLevel: number;
  truthStatus?: string;
}

/**
 * Spec 14.1 scoring formula.
 * contradicted inferences get -0.3 score (spec 14.4).
 */
export function scoreMemory(input: MemoryScoringInputs): number {
  let score =
    input.semanticSimilarity * 0.4 +
    input.importance * 0.22 +
    input.emotionalWeight * 0.18 +
    input.recencyScore * 0.1 +
    input.goalRelevance * 0.07 +
    input.relationshipRelevance * 0.03 -
    input.decayLevel * 0.15;
  if (input.truthStatus === 'contradicted') score -= 0.3;
  return score;
}
