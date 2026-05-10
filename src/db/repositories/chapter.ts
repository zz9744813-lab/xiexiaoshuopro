// db/repositories/chapter.ts - 章节仓库
import { eq, asc } from 'drizzle-orm'
import { db } from '../index'
import {
  chapterOutlines,
  chapterVersions,
  sceneMarkers,
  type ChapterOutline,
  type ChapterVersion,
  type ChapterOutlineStatus,
  type ChapterVersionSource,
  type SceneMarker,
} from '../schema'
import { logger } from '@/lib/logger'

export interface CreateChapterOutlineInput {
  volumeId: string
  chapterNum: number
  title: string
  beatsMd?: string
  targetWordCount?: number
  povCharacterId?: string
  primaryLocationId?: string
  charactersPresent?: string[]
  deliversArcBeats?: string[]
  hookIntent?: string
}

export async function createChapterOutline(
  input: CreateChapterOutlineInput
): Promise<ChapterOutline> {
  const [outline] = await db
    .insert(chapterOutlines)
    .values({
      ...input,
      charactersPresent: input.charactersPresent || [],
      deliversArcBeats: input.deliversArcBeats || [],
    })
    .returning()
  return outline
}

export async function getChapterOutlineById(id: string): Promise<ChapterOutline | null> {
  const [outline] = await db
    .select()
    .from(chapterOutlines)
    .where(eq(chapterOutlines.id, id))
    .limit(1)
  return outline || null
}

export async function listChapterOutlinesByVolume(volumeId: string): Promise<ChapterOutline[]> {
  return db
    .select()
    .from(chapterOutlines)
    .where(eq(chapterOutlines.volumeId, volumeId))
    .orderBy(asc(chapterOutlines.chapterNum))
}

export async function updateChapterOutline(
  id: string,
  data: Partial<Omit<ChapterOutline, 'id' | 'createdAt'>>
): Promise<ChapterOutline | null> {
  const [outline] = await db
    .update(chapterOutlines)
    .set(data)
    .where(eq(chapterOutlines.id, id))
    .returning()
  return outline || null
}

export async function updateChapterStatus(id: string, status: ChapterOutlineStatus): Promise<void> {
  await db.update(chapterOutlines).set({ status }).where(eq(chapterOutlines.id, id))
}

export async function createChapterVersion(data: {
  chapterId: string
  source: ChapterVersionSource
  contentMd: string
  versionLabel?: string
  parentVersionId?: string
  createdBy?: string
}): Promise<ChapterVersion> {
  const [version] = await db.insert(chapterVersions).values(data).returning()
  logger.info('Chapter version created', { versionId: version.id })
  return version
}

export async function getChapterVersions(chapterId: string): Promise<ChapterVersion[]> {
  return db
    .select()
    .from(chapterVersions)
    .where(eq(chapterVersions.chapterId, chapterId))
    .orderBy(asc(chapterVersions.createdAt))
}

export async function getLatestChapterVersion(
  chapterId: string
): Promise<ChapterVersion | null> {
  const versions = await db
    .select()
    .from(chapterVersions)
    .where(eq(chapterVersions.chapterId, chapterId))
    .orderBy(asc(chapterVersions.createdAt))
  return versions[versions.length - 1] || null
}

export async function createSceneMarker(
  data: Omit<SceneMarker, 'id'>
): Promise<SceneMarker> {
  const [marker] = await db.insert(sceneMarkers).values(data).returning()
  return marker
}

export async function listSceneMarkersByChapter(
  chapterOutlineId: string
): Promise<SceneMarker[]> {
  return db
    .select()
    .from(sceneMarkers)
    .where(eq(sceneMarkers.chapterOutlineId, chapterOutlineId))
    .orderBy(asc(sceneMarkers.order))
}
