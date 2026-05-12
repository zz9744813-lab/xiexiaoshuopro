import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { issues } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; issueId: string }> }
) {
  const { issueId } = await params
  const body = await req.json()
  await db.update(issues).set({ status: body.status }).where(eq(issues.id, issueId))
  return NextResponse.json({ ok: true })
}
