// src/lib/budget.ts
import { db } from '@/db'
import { llmCalls } from '@/db/schema'
import { sql } from 'drizzle-orm'

const MONTHLY_BUDGET_USD = Number(process.env.COST_BUDGET_MONTHLY_USD || 50)

export async function getMonthSpend(): Promise<number> {
  const result = await db.execute<{ total: string }>(sql`
    SELECT COALESCE(SUM(cost_usd), 0) AS total
    FROM llm_calls
    WHERE created_at >= date_trunc('month', NOW())
  `)
  return Number(result.rows[0]?.total ?? 0)
}

export async function getBudgetStatus() {
  const spent = await getMonthSpend()
  const ratio = spent / MONTHLY_BUDGET_USD
  return {
    spent,
    budget: MONTHLY_BUDGET_USD,
    ratio,
    level: ratio > 1 ? 'over' : ratio > 0.9 ? 'critical' : ratio > 0.8 ? 'warning' : 'ok',
  }
}

export async function assertBudgetAvailable(callerType: 'human' | 'hermes' = 'human') {
  const status = await getBudgetStatus()
  if (callerType === 'hermes' && status.ratio > 0.8) {
    throw new Error(`Budget 熔断：本月已用 ${status.spent}/${status.budget}`)
  }
  if (callerType === 'human' && status.ratio > 1.0) {
    throw new Error(`Budget 超支：本月已用 ${status.spent}/${status.budget}`)
  }
}
