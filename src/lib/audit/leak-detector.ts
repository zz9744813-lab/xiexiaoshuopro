/**
 * Privacy leak detection per spec 18.
 *
 * Strategy: fact extraction + sensitive entity matching + high-risk keywords +
 * (optional) embedding similarity. Single-step embedding comparison alone is
 * NOT sufficient (spec 18.1).
 */

const HIGH_RISK_TERMS = [
  '其实', '真正', '心里', '打算', '目的', '隐瞒', '秘密',
  '撒谎', '害怕暴露', '已经知道', '故意', '内心', '真实想法',
];

export type LeakSeverity = 'safe' | 'warning' | 'error' | 'critical';

export interface LeakCheckInput {
  privateLayerText: string;
  publicLayerText: string;
  /** named entities or sensitive terms extracted from private_layer */
  sensitiveEntities?: string[];
  /** semantic similarity score 0-1 (optional, from embedding service) */
  semanticSimilarity?: number;
  /** action verbs both layers share (optional) */
  sharedActionVerbs?: string[];
}

export interface LeakCheckResult {
  severity: LeakSeverity;
  reasons: string[];
}

/** Extract Chinese named-entity-like tokens (rough heuristic). */
export function extractTokens(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  return Array.from(new Set(matches));
}

export function detectLeak(input: LeakCheckInput): LeakCheckResult {
  const reasons: string[] = [];
  let severity: LeakSeverity = 'safe';

  const sensitive = input.sensitiveEntities ?? [];
  const publicTokens = new Set(extractTokens(input.publicLayerText));

  // Step 2: shared sensitive entities (>= 2 named entities = error)
  const sharedSensitive = sensitive.filter((s) => publicTokens.has(s));
  if (sharedSensitive.length >= 2) {
    reasons.push(`public_layer reveals sensitive facts: ${sharedSensitive.join(', ')}`);
    severity = 'error';
  } else if (sharedSensitive.length === 1) {
    reasons.push(`public_layer mentions sensitive token: ${sharedSensitive[0]}`);
    severity = 'warning';
  }

  // Step 3: high-risk keywords
  const hits = HIGH_RISK_TERMS.filter((t) => input.publicLayerText.includes(t));
  if (hits.length > 0) {
    reasons.push(`high-risk keywords in public_layer: ${hits.join(', ')}`);
    if (severity === 'safe') severity = 'warning';
  }

  // Step 4: assist embedding similarity (optional)
  if (input.semanticSimilarity !== undefined && sharedSensitive.length >= 1) {
    if (input.semanticSimilarity > 0.95 && (input.sharedActionVerbs?.length ?? 0) >= 1) {
      reasons.push('embedding similarity > 0.95 with shared action verb');
      severity = 'error';
    } else if (input.semanticSimilarity > 0.92 && sharedSensitive.length >= 2) {
      reasons.push('embedding similarity > 0.92 with >= 2 shared entities');
      if (severity === 'safe') severity = 'warning';
    }
  }

  // Critical: literal full private_thought broadcast
  if (
    input.privateLayerText &&
    input.publicLayerText.includes(input.privateLayerText) &&
    input.privateLayerText.length >= 12
  ) {
    severity = 'critical';
    reasons.push('full private_thought literally appears in public_layer');
  }

  return { severity, reasons };
}
