/**
 * Character drift detection per spec 30.
 *
 * Checks every N scenes (default 5) whether a character's recent speech
 * deviates from their baseline.
 *
 * style_consistency =
 *   embedding_similarity_to_baseline * 0.5
 * + sentence_pattern_score * 0.2
 * + forbidden_phrase_score * 0.2
 * + goal_alignment_score * 0.1
 */
import { eq, desc } from 'drizzle-orm';
import { db } from '@/db';
import {
  actions as actionsTable,
  characters as charactersTable,
  entities as entitiesTable,
} from '@/db/schema';

export type DriftLevel = 'normal' | 'monitor' | 'warning' | 'severe';

export interface DriftReport {
  entityId: string;
  entityName: string;
  level: DriftLevel;
  score: number;
  forbiddenPhraseHits: string[];
  recentSpeechSamples: string[];
  reasons: string[];
}

interface SpeechStyle {
  sample_lines?: string[];
  forbidden_phrases?: string[];
  sentence_length?: string;
  traits?: string[];
}

/** sentence_pattern_score: ratio of question marks among recent vs baseline */
function sentencePatternScore(recent: string[], baseline: string[]): number {
  const ratio = (lines: string[]) =>
    lines.length === 0
      ? 0
      : lines.filter((l) => /[?？]/.test(l)).length / lines.length;
  const r = ratio(recent);
  const b = ratio(baseline);
  // 1 - |r - b|
  return Math.max(0, 1 - Math.abs(r - b) * 2);
}

/** forbidden_phrase_score: 1 - (hits / max(recent.length, 1)) */
function forbiddenPhraseScore(
  recent: string[],
  forbidden: string[],
): { score: number; hits: string[] } {
  if (forbidden.length === 0) return { score: 1, hits: [] };
  const hits: string[] = [];
  for (const line of recent) {
    for (const fp of forbidden) {
      if (fp && line.includes(fp)) hits.push(fp);
    }
  }
  const score = Math.max(0, 1 - hits.length / Math.max(recent.length, 1));
  return { score, hits };
}

/** Goal alignment - simple keyword overlap heuristic */
function goalAlignmentScore(recentDesired: string[], desireKeywords: string[]): number {
  if (desireKeywords.length === 0) return 0.5;
  let hits = 0;
  for (const d of recentDesired) {
    if (desireKeywords.some((k) => d.includes(k))) hits++;
  }
  return recentDesired.length === 0 ? 0.5 : hits / recentDesired.length;
}

export async function detectCharacterDrift(args: {
  worldId: string;
  worldlineId: string;
  entityId: string;
  /** Number of recent spoken_text samples to evaluate */
  recentN?: number;
}): Promise<DriftReport> {
  const recentN = args.recentN ?? 10;

  const [entity] = await db
    .select()
    .from(entitiesTable)
    .where(eq(entitiesTable.id, args.entityId));
  if (!entity) throw new Error('Entity not found');

  const [char] = await db
    .select()
    .from(charactersTable)
    .where(eq(charactersTable.entityId, args.entityId));

  const speechStyle = ((char?.speechStyle ?? {}) as SpeechStyle) || {};
  const desireProfile = (char?.desireProfile as Record<string, unknown>) ?? {};
  const baseline = speechStyle.sample_lines ?? [];
  const forbidden = speechStyle.forbidden_phrases ?? [];

  // Load recent actions for this entity in this worldline
  const recentActions = await db
    .select()
    .from(actionsTable)
    .where(eq(actionsTable.entityId, args.entityId))
    .orderBy(desc(actionsTable.createdAt))
    .limit(recentN * 3); // overfetch in case some have empty spoken_text

  const recentSpeech = recentActions
    .map((a) => {
      const pl = a.publicLayer as Record<string, unknown>;
      return typeof pl.spoken_text === 'string' ? pl.spoken_text : '';
    })
    .filter((s) => s.length > 0)
    .slice(0, recentN);

  const recentDesired = recentActions
    .map((a) => {
      const raw = a.rawModelOutput as Record<string, unknown> | null;
      return typeof raw?.desired_next_action === 'string' ? raw.desired_next_action : '';
    })
    .filter((s) => s.length > 0)
    .slice(0, recentN);

  // 1. embedding_similarity_to_baseline - skip without embedding service for MVP
  // We approximate with character-level overlap for now.
  const embeddingSimilarity =
    baseline.length === 0 || recentSpeech.length === 0
      ? 0.5
      : computeOverlapScore(recentSpeech.join(' '), baseline.join(' '));

  // 2. sentence_pattern_score
  const sentencePattern = sentencePatternScore(recentSpeech, baseline);

  // 3. forbidden_phrase_score
  const fpResult = forbiddenPhraseScore(recentSpeech, forbidden);

  // 4. goal_alignment_score - keywords from desire_profile.core_desire + short_term_goal
  const desireKeywords: string[] = [];
  for (const key of ['core_desire', 'short_term_goal', 'long_term_goal']) {
    const v = desireProfile[key];
    if (typeof v === 'string') {
      const tokens = v.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
      desireKeywords.push(...tokens);
    }
  }
  const goalAlignment = goalAlignmentScore(recentDesired, desireKeywords);

  const score =
    embeddingSimilarity * 0.5 +
    sentencePattern * 0.2 +
    fpResult.score * 0.2 +
    goalAlignment * 0.1;

  let level: DriftLevel = 'normal';
  if (score < 0.4) level = 'severe';
  else if (score < 0.6) level = 'warning';
  else if (score < 0.8) level = 'monitor';

  const reasons: string[] = [];
  if (fpResult.hits.length > 0) {
    reasons.push(`命中禁忌词 ${fpResult.hits.length} 次：${fpResult.hits.slice(0, 5).join(', ')}`);
  }
  if (embeddingSimilarity < 0.5) {
    reasons.push('近期语言风格与样本台词相似度偏低');
  }
  if (goalAlignment < 0.3 && desireKeywords.length > 0) {
    reasons.push('近期意图与角色核心欲望关联弱');
  }

  return {
    entityId: entity.id,
    entityName: entity.name,
    level,
    score,
    forbiddenPhraseHits: fpResult.hits,
    recentSpeechSamples: recentSpeech.slice(0, 3),
    reasons,
  };
}

/** Simple character bigram overlap score */
function computeOverlapScore(a: string, b: string): number {
  if (!a || !b) return 0;
  const bigrams = (s: string) => {
    const out = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
    return out;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}
