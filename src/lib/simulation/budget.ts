/**
 * Cost budget tracking and circuit breaker per spec 25.
 *
 * per_round budget includes ALL phase calls in hybrid mode (spec 25.1).
 */
import { eq, and, gte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { costLogs, apiProfiles } from '@/db/schema';

export type BudgetScope = 'per_call' | 'per_round' | 'per_scene' | 'per_day';

export type OnExceedAction = 'pause' | 'fallback' | 'abort' | 'degrade';

export interface BudgetConfig {
  perCall?: number;
  perRound?: number;
  perScene?: number;
  perDay?: number;
  onExceed?: OnExceedAction;
}

export interface BudgetStatus {
  scope: BudgetScope;
  used: number;
  limit: number;
  exceeded: boolean;
  warning: boolean; // > 80%
}

const WARNING_THRESHOLD = 0.8;

export async function loadBudgetForProfile(apiProfileId: string): Promise<BudgetConfig> {
  const [p] = await db.select().from(apiProfiles).where(eq(apiProfiles.id, apiProfileId));
  if (!p) return {};
  return {
    perCall: p.costLimitPerCall ? Number(p.costLimitPerCall) : undefined,
    perRound: p.costLimitPerRun ? Number(p.costLimitPerRun) : undefined, // mapped: per_run~per_round
    perDay: p.costLimitPerDay ? Number(p.costLimitPerDay) : undefined,
  };
}

export async function getRoundCost(roundId: string): Promise<number> {
  const rows = await db
    .select({ s: sql<string>`sum(${costLogs.costUsd})` })
    .from(costLogs)
    .where(eq(costLogs.roundId, roundId));
  return Number(rows[0]?.s ?? 0);
}

export async function getSceneCost(sceneId: string): Promise<number> {
  const rows = await db
    .select({ s: sql<string>`sum(${costLogs.costUsd})` })
    .from(costLogs)
    .where(eq(costLogs.sceneId, sceneId));
  return Number(rows[0]?.s ?? 0);
}

export async function getDayCost(worldId: string, daysAgo = 0): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - daysAgo);
  const rows = await db
    .select({ s: sql<string>`sum(${costLogs.costUsd})` })
    .from(costLogs)
    .where(and(eq(costLogs.worldId, worldId), gte(costLogs.createdAt, start)));
  return Number(rows[0]?.s ?? 0);
}

export async function checkBudget(args: {
  apiProfileId: string;
  worldId: string;
  roundId?: string;
  sceneId?: string;
}): Promise<BudgetStatus[]> {
  const cfg = await loadBudgetForProfile(args.apiProfileId);
  const results: BudgetStatus[] = [];

  if (cfg.perRound && args.roundId) {
    const used = await getRoundCost(args.roundId);
    results.push({
      scope: 'per_round',
      used,
      limit: cfg.perRound,
      exceeded: used >= cfg.perRound,
      warning: used >= cfg.perRound * WARNING_THRESHOLD,
    });
  }
  if (cfg.perScene && args.sceneId) {
    const used = await getSceneCost(args.sceneId);
    results.push({
      scope: 'per_scene',
      used,
      limit: cfg.perScene,
      exceeded: used >= cfg.perScene,
      warning: used >= cfg.perScene * WARNING_THRESHOLD,
    });
  }
  if (cfg.perDay) {
    const used = await getDayCost(args.worldId);
    results.push({
      scope: 'per_day',
      used,
      limit: cfg.perDay,
      exceeded: used >= cfg.perDay,
      warning: used >= cfg.perDay * WARNING_THRESHOLD,
    });
  }
  return results;
}

/** Decide what to do when any budget is exceeded. */
export function decideOnExceed(
  statuses: BudgetStatus[],
  defaultAction: OnExceedAction = 'fallback',
): { exceeded: boolean; warning: boolean; action: OnExceedAction } {
  const exceeded = statuses.some((s) => s.exceeded);
  const warning = statuses.some((s) => s.warning);
  return { exceeded, warning, action: defaultAction };
}
