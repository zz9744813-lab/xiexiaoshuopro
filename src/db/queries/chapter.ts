// src/db/queries/chapter.ts — Chapter query helpers
import { eq, desc, asc, and } from 'drizzle-orm'
import { db } from '@/db'
import { chapters, chapterVersions, chapterSummaries } from '@/db/schema'

/** Get chapter with its active version */
export async function getChapterWithActiveVersion(chapterId: string) {
  const [chapter] = await db
    .select()
    .from(chapters)
    .where(eq(chapters.id, chapterId))

  if (!chapter) return null

  const versions = await db
    .select()
    .from(chapterVersions)
    .where(eq(chapterVersions.chapterId, chapterId))
    .orderBy(desc(chapterVersions.createdAt))

  return { ...chapter, versions }
}

/** Get chapter context: outline + summaries of previous chapters */
export async function getChapterContext(projectId: string, volumeId: string, chapterNumber: number) {
  // Previous chapters in same volume
  const prevChapters = await db
    .select()
    .from(chapters)
    .where(and(eq(chapters.volumeId, volumeId), eq(chapters.chapterNumber, chapterNumber - 1)))

  // Summaries of recent chapters
  const recentSummaries = await db
    .select()
    .from(chapterSummaries)
    .where(eq(chapterSummaries.projectId, projectId))
    .orderBy(desc(chapterSummaries.createdAt))
    .limit(5)

  return { prevChapters, recentSummaries }
}

/** Append a new chapter version */
export async function appendChapterVersion(params: {
  chapterId: string
  contentMd: string
  source: string
  versionLabel?: string
  parentVersionId?: string
}) {
  const [version] = await db
    .insert(chapterVersions)
    .values({
      chapterId: params.chapterId,
      contentMd: params.contentMd,
      source: params.source,
      versionLabel: params.versionLabel || `v${Date.now()}`,
      parentVersionId: params.parentVersionId || null,
    })
    .returning()

  return version
}

/** Set active version on a chapter */
export async function setActiveVersion(chapterId: string, versionId: string) {
  await db.update(chapters).set({ activeVersionId: versionId }).where(eq(chapters.id, chapterId))
}

/** List all versions for a chapter */
export async function listChapterVersions(chapterId: string) {
  return db
    .select()
    .from(chapterVersions)
    .where(eq(chapterVersions.chapterId, chapterId))
    .orderBy(desc(chapterVersions.createdAt))
}
