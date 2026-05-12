// src/app/api/projects/[id]/plot-threads/route.ts
import { db } from '@/db'
import { foreshadowings } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const rows = await db.select().from(foreshadowings).where(eq(foreshadowings.projectId, id))
  return Response.json(rows)
}
