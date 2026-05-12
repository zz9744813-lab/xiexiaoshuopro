// src/app/api/projects/[id]/cost-summary/route.ts
import { getBudgetStatus } from '@/lib/budget'
import { db } from '@/db'
import { llmCalls, jobs } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const status = await getBudgetStatus()
  
  const result = await db.execute<{ total: string; calls: string }>(sql`
    SELECT COALESCE(SUM(cost_usd), 0) AS total, COUNT(*) AS calls
    FROM llm_calls
    JOIN jobs ON llm_calls.job_id = jobs.id
    WHERE jobs.project_id = ${id}
  `)
  
  return Response.json({
    project: {
      totalSpend: Number(result.rows[0]?.total ?? 0),
      totalCalls: Number(result.rows[0]?.calls ?? 0),
    },
    global: status,
  })
}
