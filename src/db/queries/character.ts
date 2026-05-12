// src/db/queries/character.ts — Character query helpers
import { eq, desc, and } from 'drizzle-orm'
import { db } from '@/db'
import {
  characters,
  characterRelationships,
  characterAppearances,
  characterEpisodicMemory,
} from '@/db/schema'

/** Get all characters in a project */
export async function getCharacterRoster(projectId: string) {
  return db
    .select()
    .from(characters)
    .where(eq(characters.projectId, projectId))
    .orderBy(desc(characters.updatedAt))
}

/** Get principal (major) characters */
export async function getPrincipalCharacters(projectId: string) {
  return db
    .select()
    .from(characters)
    .where(and(eq(characters.projectId, projectId), eq(characters.tier, 'principal')))
}

/** Record a character appearance in a chapter */
export async function recordAppearance(params: {
  characterId: string
  chapterId: string
  sceneMarker?: string
  role: 'speaking' | 'present' | 'mentioned'
}) {
  const [appearance] = await db
    .insert(characterAppearances)
    .values({
      characterId: params.characterId,
      chapterId: params.chapterId,
      sceneMarker: params.sceneMarker || null,
      role: params.role,
    })
    .returning()
  return appearance
}

/** Get relationships for a character */
export async function getRelationships(characterId: string) {
  return db
    .select()
    .from(characterRelationships)
    .where(eq(characterRelationships.fromCharacterId, characterId))
}

/** Search episodic memory for a character */
export async function searchEpisodicMemory(characterId: string, limit = 10) {
  return db
    .select()
    .from(characterEpisodicMemory)
    .where(eq(characterEpisodicMemory.characterId, characterId))
    .orderBy(desc(characterEpisodicMemory.createdAt))
    .limit(limit)
}
