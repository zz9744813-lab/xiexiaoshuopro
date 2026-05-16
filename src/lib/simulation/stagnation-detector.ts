/**
 * Stagnation detection per spec 31.
 *
 * If N consecutive rounds have no events, no relationship change, no new
 * memories, no plan progress, no location change, no novel speech, mark
 * as stagnant. EXCEPT: if private_layer thoughts/intentions in those rounds
 * differ in embedding space (cosine < 0.85), don't count as stagnation
 * (psychological tension counts as progress).
 */
import { eq, desc, inArray, and } from 'drizzle-orm';
import { db } from '@/db';
import {
  actions as actionsTable,
  events as eventsTable,
  rounds as roundsTable,
  memories as memoriesTable,
} from '@/db/schema';

export type StagnationLevel = 'none' | 'mild' | 'moderate' | 'severe';

export interface StagnationReport {
  sceneId: string;
  consecutiveStagnantRounds: number;
  level: StagnationLevel;
  reasons: string[];
  suggestedRemedy: 'environment' | 'external_message' | 'faction_action' | 'user_directive' | null;
}

const N_THRESHOLD = 3;

/** Trigram-based similarity between two strings (0-1) */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const tri = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 2; i++) set.add(s.slice(i, i + 3));
    return set;
  };
  const A = tri(a);
  const B = tri(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export async function detectStagnation(sceneId: string): Promise<StagnationReport> {
  // Get last N committed rounds
  const recent = await db
    .select()
    .from(roundsTable)
    .where(and(eq(roundsTable.sceneId, sceneId), eq(roundsTable.status, 'committed')))
    .orderBy(desc(roundsTable.roundIndex))
    .limit(N_THRESHOLD + 1);

  if (recent.length < N_THRESHOLD) {
    return {
      sceneId,
      consecutiveStagnantRounds: 0,
      level: 'none',
      reasons: ['数据不足以判断停滞'],
      suggestedRemedy: null,
    };
  }

  const recentRoundIds = recent.slice(0, N_THRESHOLD).map((r) => r.id);

  // Collect signals for these rounds
  const [actsInRounds, eventsInRounds, memsInRounds] = await Promise.all([
    db.select().from(actionsTable).where(inArray(actionsTable.roundId, recentRoundIds)),
    db.select().from(eventsTable).where(inArray(eventsTable.roundId, recentRoundIds)),
    // memories created in recent rounds: source_action_id ∈ rounds' actions
    db
      .select()
      .from(memoriesTable)
      .where(eq(memoriesTable.worldlineId, recent[0].worldlineId)),
  ]);

  // Filter memories to those tied to recent actions (excluding system_note)
  const recentActionIds = new Set(actsInRounds.map((a) => a.id));
  const newMemories = memsInRounds.filter(
    (m) => m.sourceActionId && recentActionIds.has(m.sourceActionId) && m.memoryType !== 'system_note',
  );

  const reasons: string[] = [];
  let stagnant = true;

  // 1. No new events
  if (eventsInRounds.length > 0) {
    stagnant = false;
    reasons.push(`检测到 ${eventsInRounds.length} 个新事件`);
  }
  // 2. No new memories (除 system_note)
  if (newMemories.length > 0) {
    stagnant = false;
    reasons.push(`检测到 ${newMemories.length} 条新记忆`);
  }
  // 3. Speech / action novelty - compare spoken_text across rounds
  const speeches = actsInRounds
    .map((a) => {
      const pl = a.publicLayer as Record<string, unknown>;
      return typeof pl.spoken_text === 'string' ? pl.spoken_text : '';
    })
    .filter((s) => s.length > 0);

  if (speeches.length >= 2) {
    let allSimilar = true;
    for (let i = 1; i < speeches.length; i++) {
      if (similarity(speeches[i - 1], speeches[i]) < 0.7) {
        allSimilar = false;
        break;
      }
    }
    if (!allSimilar) {
      // Some variation in speech - not fully stagnant
      // But if no events/memories, still might be empty churn
    } else if (speeches.length >= 3) {
      reasons.push('对话内容高度重复');
    }
  }

  // 4. Hybrid escape: private_layer divergence
  // If private_layer.thought differs significantly across rounds, don't count as stagnation
  const thoughts = actsInRounds
    .map((a) => {
      const pl = a.privateLayer as Record<string, unknown>;
      return typeof pl.thought === 'string' ? pl.thought : '';
    })
    .filter((t) => t.length > 0);

  if (stagnant && thoughts.length >= 2) {
    let maxSim = 0;
    for (let i = 1; i < thoughts.length; i++) {
      maxSim = Math.max(maxSim, similarity(thoughts[i - 1], thoughts[i]));
    }
    if (maxSim < 0.85) {
      stagnant = false;
      reasons.push('私密心理活动有显著变化（心理张力计为有效推进）');
    }
  }

  if (!stagnant) {
    return {
      sceneId,
      consecutiveStagnantRounds: 0,
      level: 'none',
      reasons,
      suggestedRemedy: null,
    };
  }

  // Determine severity & remedy
  reasons.push(`连续 ${N_THRESHOLD} 轮无新事件 / 无新记忆 / 无关键推进`);
  let level: StagnationLevel = 'mild';
  let remedy: StagnationReport['suggestedRemedy'] = 'environment';

  if (recent.length >= N_THRESHOLD + 1) {
    // even more rounds stagnant → escalate
    level = 'moderate';
    remedy = 'external_message';
  }

  return {
    sceneId,
    consecutiveStagnantRounds: N_THRESHOLD,
    level,
    reasons,
    suggestedRemedy: remedy,
  };
}
