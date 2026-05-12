// db/queries/chapter.ts — 章节查询层
import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "@/db";
import {
  chapters,
  chapterVersions,
  chapterOutlines,
  chapterSummaries,
  chapterChunks,
} from "@/db/schema";

/** 获取章节及其当前活跃版本 */
export async function getChapterWithActiveVersion(chapterId: string) {
  const [chapter] = await db
    .select()
    .from(chapters)
    .where(eq(chapters.id, chapterId));

  if (!chapter?.activeVersionId) return { chapter, version: null };

  const [version] = await db
    .select()
    .from(chapterVersions)
    .where(eq(chapterVersions.id, chapter.activeVersionId));

  return { chapter, version };
}

/** 获取章节完整上下文：大纲 + 章节 + 版本 + 摘要 */
export async function getChapterContext(chapterId: string) {
  const { chapter, version } = await getChapterWithActiveVersion(chapterId);
  if (!chapter) return null;

  const [outline] = await db
    .select()
    .from(chapterOutlines)
    .where(eq(chapterOutlines.id, chapter.outlineId));

  const [summary] = await db
    .select()
    .from(chapterSummaries)
    .where(and(eq(chapterSummaries.chapterId, chapterId), eq(chapterSummaries.versionId, chapter.activeVersionId ?? "")));

  return { chapter, version, outline, summary };
}

/** 追加新版本到章节 */
export async function appendChapterVersion(input: {
  chapterId: string;
  source: string;
  contentMd: string;
  wordCount: number;
  modelId?: string;
  cost?: number;
  jobId?: string;
}) {
  const [version] = await db
    .insert(chapterVersions)
    .values({
      chapterId: input.chapterId,
      source: input.source as any,
      contentMd: input.contentMd,
      wordCount: input.wordCount,
      modelId: input.modelId,
      cost: input.cost ? String(input.cost) : null,
      jobId: input.jobId,
    })
    .returning();
  return version;
}

/** 列出章节的所有版本 */
export async function listChapterVersions(chapterId: string) {
  return db
    .select()
    .from(chapterVersions)
    .where(eq(chapterVersions.chapterId, chapterId))
    .orderBy(desc(chapterVersions.createdAt));
}

/** 获取章节 RAG 分块 */
export async function getChapterChunks(chapterId: string) {
  return db
    .select()
    .from(chapterChunks)
    .where(eq(chapterChunks.chapterId, chapterId))
    .orderBy(asc(chapterChunks.chunkIndex));
}
