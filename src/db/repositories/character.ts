// db/repositories/character.ts - 角色仓库
import { eq, asc } from 'drizzle-orm'
import { db } from '../index'
import {
  characters,
  characterRelationships,
  type Character,
  type CharacterTier,
  type CharacterRelationship,
} from '../schema'
import { logger } from '@/lib/logger'

export interface CreateCharacterInput {
  projectId: string
  name: string
  tier: CharacterTier
  appearance?: string
  publicRole?: string
  voiceMd?: string
  secretMotive?: string
  trueIntent?: string
  arcGoal?: string
  arcPosition?: number
  currentEmotionalState?: string
}

export async function createCharacter(input: CreateCharacterInput): Promise<Character> {
  const [character] = await db
    .insert(characters)
    .values(input)
    .returning()
  logger.info('Character created', { characterId: character.id, name: input.name })
  return character
}

export async function getCharacterById(id: string): Promise<Character | null> {
  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, id))
    .limit(1)
  return character || null
}

export async function listCharactersByProject(projectId: string): Promise<Character[]> {
  return db
    .select()
    .from(characters)
    .where(eq(characters.projectId, projectId))
    .orderBy(asc(characters.name))
}

export async function listMainCharacters(projectId: string): Promise<Character[]> {
  return db
    .select()
    .from(characters)
    .where(eq(characters.projectId, projectId))
    .orderBy(
      // principal first, then recurring, then walk_on
      characters.tier
    )
}

export async function updateCharacter(
  id: string,
  data: Partial<Omit<Character, 'id' | 'createdAt'>>
): Promise<Character | null> {
  const [character] = await db
    .update(characters)
    .set(data)
    .where(eq(characters.id, id))
    .returning()
  return character || null
}

export async function deleteCharacter(id: string): Promise<void> {
  await db.delete(characters).where(eq(characters.id, id))
}

export async function createRelationship(
  data: Omit<CharacterRelationship, 'id'>
): Promise<CharacterRelationship> {
  const [rel] = await db.insert(characterRelationships).values(data).returning()
  return rel
}

export async function getRelationshipsByCharacter(characterId: string): Promise<CharacterRelationship[]> {
  const rels = await db
    .select()
    .from(characterRelationships)

  // Filter manually since we have two columns to check
  return rels.filter(
    r => r.characterA === characterId || r.characterB === characterId
  )
}
