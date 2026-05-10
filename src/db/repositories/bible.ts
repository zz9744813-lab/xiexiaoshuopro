// db/repositories/bible.ts - 世界观/圣经仓库
import { eq, asc } from 'drizzle-orm'
import { db } from '../index'
import { canonFacts, worldEntries, type CanonFact, type WorldEntry } from '../schema'
import { logger } from '@/lib/logger'

export interface CreateCanonFactInput {
  projectId: string
  fact: string
  category?: string
  sourceChapterId?: string
  immutable?: boolean
}

export async function createCanonFact(input: CreateCanonFactInput): Promise<CanonFact> {
  const [fact] = await db.insert(canonFacts).values(input).returning()
  logger.info('Canon fact created', { factId: fact.id })
  return fact
}

export async function getCanonFactById(id: string): Promise<CanonFact | null> {
  const [fact] = await db.select().from(canonFacts).where(eq(canonFacts.id, id)).limit(1)
  return fact || null
}

export async function listCanonFactsByProject(projectId: string): Promise<CanonFact[]> {
  return db
    .select()
    .from(canonFacts)
    .where(eq(canonFacts.projectId, projectId))
    .orderBy(asc(canonFacts.createdAt))
}

export async function listCanonFactsByCategory(
  projectId: string,
  category: string
): Promise<CanonFact[]> {
  return db
    .select()
    .from(canonFacts)
    .where(eq(canonFacts.projectId, projectId))
    .orderBy(asc(canonFacts.createdAt))
}

export async function updateCanonFact(
  id: string,
  data: Partial<Omit<CanonFact, 'id' | 'createdAt'>>
): Promise<CanonFact | null> {
  const [fact] = await db.update(canonFacts).set(data).where(eq(canonFacts.id, id)).returning()
  return fact || null
}

export async function deleteCanonFact(id: string): Promise<void> {
  await db.delete(canonFacts).where(eq(canonFacts.id, id))
}

export interface CreateWorldEntryInput {
  projectId: string
  kind: string // location|item|concept|magic|faction|rule
  name: string
  description?: string
  rules?: string
  parentId?: string
}

export async function createWorldEntry(input: CreateWorldEntryInput): Promise<WorldEntry> {
  const [entry] = await db.insert(worldEntries).values(input).returning()
  logger.info('World entry created', { entryId: entry.id, kind: input.kind, name: input.name })
  return entry
}

export async function getWorldEntryById(id: string): Promise<WorldEntry | null> {
  const [entry] = await db.select().from(worldEntries).where(eq(worldEntries.id, id)).limit(1)
  return entry || null
}

export async function listWorldEntriesByProject(projectId: string): Promise<WorldEntry[]> {
  return db
    .select()
    .from(worldEntries)
    .where(eq(worldEntries.projectId, projectId))
    .orderBy(asc(worldEntries.kind), asc(worldEntries.name))
}

export async function listWorldEntriesByKind(projectId: string, kind: string): Promise<WorldEntry[]> {
  return db
    .select()
    .from(worldEntries)
    .where(eq(worldEntries.projectId, projectId))
    .orderBy(asc(worldEntries.name))
}

export async function updateWorldEntry(
  id: string,
  data: Partial<Omit<WorldEntry, 'id' | 'createdAt'>>
): Promise<WorldEntry | null> {
  const [entry] = await db.update(worldEntries).set(data).where(eq(worldEntries.id, id)).returning()
  return entry || null
}

export async function deleteWorldEntry(id: string): Promise<void> {
  await db.delete(worldEntries).where(eq(worldEntries.id, id))
}

export async function searchWorldEntries(
  projectId: string,
  query: string
): Promise<WorldEntry[]> {
  // 简单搜索：匹配名称或描述
  const entries = await listWorldEntriesByProject(projectId)
  const lowerQuery = query.toLowerCase()
  return entries.filter(
    (e) =>
      e.name.toLowerCase().includes(lowerQuery) ||
      e.description?.toLowerCase().includes(lowerQuery)
  )
}
