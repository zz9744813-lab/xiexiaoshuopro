// src/db/queries/world.ts — World / Bible query helpers
import { eq, desc, ilike } from 'drizzle-orm'
import { db } from '@/db'
import { canonFacts, worldEntries } from '@/db/schema'

/** Search world entries by text (case-insensitive) */
export async function searchBibleByText(projectId: string, query: string, limit = 20) {
  return db
    .select()
    .from(worldEntries)
    .where(and(eq(worldEntries.projectId, projectId), ilike(worldEntries.title, `%${query}%`)))
    .limit(limit)
}

/** Get all canon facts for a project */
export async function getCanonFacts(projectId: string) {
  return db
    .select()
    .from(canonFacts)
    .where(eq(canonFacts.projectId, projectId))
    .orderBy(desc(canonFacts.createdAt))
}

/** Add a world entry */
export async function addWorldEntry(params: {
  projectId: string
  title: string
  contentMd: string
  tags?: string[]
}) {
  const [entry] = await db
    .insert(worldEntries)
    .values({
      projectId: params.projectId,
      title: params.title,
      contentMd: params.contentMd,
      tags: params.tags || [],
    })
    .returning()
  return entry
}

/** Add a canon fact */
export async function addCanonFact(params: {
  projectId: string
  fact: string
  source: string
  confidence: number
}) {
  const [fact] = await db
    .insert(canonFacts)
    .values({
      projectId: params.projectId,
      fact: params.fact,
      source: params.source,
      confidence: params.confidence,
    })
    .returning()
  return fact
}
