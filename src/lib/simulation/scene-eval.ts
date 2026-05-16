/**
 * Scene-level evaluation per spec 29.4.
 *
 * Computes: privacy_score, consistency_score, causality_score, agency_score,
 * drama_score, novelty_score, stagnation_score, cost_score.
 *
 * MVP: heuristic-based. Embedding-based & LLM-judge versions can replace later.
 */
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  actions as actionsTable,
  events as eventsTable,
  auditLogs,
  costLogs,
  scenes as scenesTable,
  rounds as roundsTable,
} from '@/db/schema';
import { detectStagnation } from './stagnation-detector';

export interface SceneEval {
  sceneId: string;
  privacyScore: number;
  consistencyScore: number;
  causalityScore: number;
  agencyScore: number;
  dramaScore: number;
  noveltyScore: number;
  stagnationScore: number;
  costScore: number;
  warnings: string[];
}

export async function evaluateScene(sceneId: string): Promise<SceneEval> {
  const [scene] = await db.select().from(scenesTable).where(eq(scenesTable.id, sceneId));
  if (!scene) throw new Error('Scene not found');

  const [acts, evs, audits, costs, rs] = await Promise.all([
    db.select().from(actionsTable).where(eq(actionsTable.sceneId, sceneId)),
    db.select().from(eventsTable).where(eq(eventsTable.sceneId, sceneId)),
    db
      .select({ severity: auditLogs.severity, count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(eq(auditLogs.sceneId, sceneId))
      .groupBy(auditLogs.severity),
    db
      .select({ total: sql<string>`coalesce(sum(${costLogs.costUsd}), 0)` })
      .from(costLogs)
      .where(eq(costLogs.sceneId, sceneId)),
    db.select().from(roundsTable).where(eq(roundsTable.sceneId, sceneId)),
  ]);

  const warnings: string[] = [];

  // privacy_score: based on audit findings
  const auditMap = new Map(audits.map((a) => [a.severity, Number(a.count)]));
  const privacyDeduction =
    (auditMap.get('warning') ?? 0) * 0.05 +
    (auditMap.get('error') ?? 0) * 0.2 +
    (auditMap.get('critical') ?? 0) * 0.5;
  const privacyScore = Math.max(0, Math.min(1, 1 - privacyDeduction));
  if (privacyScore < 0.9) warnings.push(`隐私分 ${privacyScore.toFixed(2)} - 检查泄漏审计`);

  // consistency_score: % of actions with non-fallback + no validation errors
  // (validation errors would have created action with rawModelOutput=null)
  const totalActions = acts.length;
  const fallbacks = acts.filter((a) => a.isFallback).length;
  const consistencyScore =
    totalActions === 0 ? 0.5 : Math.max(0, 1 - fallbacks / totalActions);

  // causality_score: events have source_action_ids
  const eventsWithSource = evs.filter((e) => (e.sourceActionIds ?? []).length > 0).length;
  const causalityScore = evs.length === 0 ? 0.5 : eventsWithSource / evs.length;

  // agency_score: action types diversity (more varied = more agency)
  const actionTypes = new Set(acts.map((a) => a.actionType));
  const agencyScore = Math.min(1, actionTypes.size / 5);

  // drama_score: events with event_level >= meaningful
  const meaningfulEvents = evs.filter((e) =>
    ['meaningful', 'major', 'extreme'].includes(e.eventLevel),
  ).length;
  const dramaScore = evs.length === 0 ? 0.3 : Math.min(1, meaningfulEvents / Math.max(rs.length, 1));

  // novelty_score: events per round (more novel events = higher)
  const noveltyScore = rs.length === 0 ? 0.3 : Math.min(1, evs.length / rs.length);

  // stagnation_score: low stagnation is good (so we invert)
  const stag = await detectStagnation(sceneId);
  const stagnationScore =
    stag.level === 'none' ? 1 : stag.level === 'mild' ? 0.7 : stag.level === 'moderate' ? 0.4 : 0.1;

  // cost_score: cost per round
  const totalCost = Number(costs[0]?.total ?? 0);
  const avgCostPerRound = rs.length === 0 ? totalCost : totalCost / rs.length;
  // Below $0.5/round = good, above $2/round = bad
  const costScore = Math.max(0, Math.min(1, 1 - (avgCostPerRound - 0.5) / 1.5));

  if (consistencyScore < 0.8) warnings.push(`一致性分 ${consistencyScore.toFixed(2)} - 失败/降级过多`);
  if (causalityScore < 0.7) warnings.push(`因果分 ${causalityScore.toFixed(2)} - 事件缺乏 source_action 引用`);
  if (stag.level !== 'none') warnings.push(`检测到 ${stag.level} 级别停滞`);

  return {
    sceneId,
    privacyScore,
    consistencyScore,
    causalityScore,
    agencyScore,
    dramaScore,
    noveltyScore,
    stagnationScore,
    costScore,
    warnings,
  };
}
