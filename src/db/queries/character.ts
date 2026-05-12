// db/queries/character.ts — 角色查询层
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  characters,
  characterRelationships,
  characterAppearances,
  characterKnowledge,
  characterEpisodicMemory,
} from "@/db/schema";

/** 获取项目角色阵容 */
export async function getCharacterRoster(projectId: string) {
  return db.select().from(characters).where(eq(characters.projectId, projectId));
}

/** 获取主要角色（tier = 'principal'） */
export async function getPrincipalCharacters(projectId: string) {
  return db
    .select()
    .from(characters)
    .where(and(eq(characters.projectId, projectId), eq(characters.tier, "principal")));
}

/** 记录角色出场 */
export async function recordAppearance(input: {
  characterId: string;
  chapterId: string;
  sceneIndex: number;
  presenceType?: string;
}) {
  const [appearance] = await db
    .insert(characterAppearances)
    .values({
      characterId: input.characterId,
      chapterId: input.chapterId,
      sceneIndex: input.sceneIndex,
      presenceType: input.presenceType,
    })
    .returning();
  return appearance;
}

/** 获取角色关系 */
export async function getCharacterRelationships(characterId: string) {
  return db
    .select()
    .from(characterRelationships)
    .where(eq(characterRelationships.characterId, characterId));
}

/** 获取角色知识 */
export async function getCharacterKnowledge(characterId: string) {
  return db
    .select()
    .from(characterKnowledge)
    .where(eq(characterKnowledge.characterId, characterId))
    .orderBy(desc(characterKnowledge.confidence));
}

/** 搜索角色情景记忆 */
export async function searchEpisodicMemory(characterId: string, limit = 10) {
  return db
    .select()
    .from(characterEpisodicMemory)
    .where(eq(characterEpisodicMemory.characterId, characterId))
    .orderBy(desc(characterEpisodicMemory.createdAt))
    .limit(limit);
}
