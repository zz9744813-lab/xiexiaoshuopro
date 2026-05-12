// db/queries/world.ts — 世界/Bible 查询层
import { eq, and, or, like, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  canonFacts,
  worldEntries,
  factions,
  factionRelations,
  timelineEvents,
} from "@/db/schema";

/** 按文本搜索 Bible 条目 */
export async function searchBibleByText(projectId: string, query: string, limit = 10) {
  const pattern = `%${query}%`;
  return db
    .select()
    .from(worldEntries)
    .where(
      and(
        eq(worldEntries.projectId, projectId),
        or(
          like(worldEntries.title, pattern),
          like(worldEntries.content, pattern),
          like(worldEntries.tags, pattern)
        )
      )
    )
    .limit(limit);
}

/** 获取 Canon 硬事实 */
export async function getCanonFacts(projectId: string, category?: string) {
  const conditions = [eq(canonFacts.projectId, projectId)];
  if (category) {
    conditions.push(eq(canonFacts.category, category));
  }
  return db
    .select()
    .from(canonFacts)
    .where(and(...conditions))
    .orderBy(desc(canonFacts.updatedAt));
}

/** 获取势力列表 */
export async function getFactions(projectId: string) {
  return db.select().from(factions).where(eq(factions.projectId, projectId));
}

/** 获取势力关系 */
export async function getFactionRelationships(projectId: string) {
  return db
    .select()
    .from(factionRelations)
    .where(eq(factionRelations.projectId, projectId));
}

/** 获取时间线事件 */
export async function getTimelineEvents(projectId: string, limit = 20) {
  return db
    .select()
    .from(timelineEvents)
    .where(eq(timelineEvents.projectId, projectId))
    .orderBy(desc(timelineEvents.timestamp))
    .limit(limit);
}
