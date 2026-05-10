// db/repositories/volume.ts - 卷册仓库
import { eq, asc } from 'drizzle-orm'
import { db } from '../index'
import { volumes, type Volume, type VolumeStatus } from '../schema'
import { logger } from '@/lib/logger'

export interface CreateVolumeInput {
  projectId: string
  volumeNum: number
  title: string
  thesis?: string
  arcBeats?: Record<string, unknown>[]
  readerPromise?: string
}

export async function createVolume(input: CreateVolumeInput): Promise<Volume> {
  const [volume] = await db.insert(volumes).values(input).returning()
  logger.info('Volume created', { volumeId: volume.id, projectId: input.projectId })
  return volume
}

export async function getVolumeById(id: string): Promise<Volume | null> {
  const [volume] = await db.select().from(volumes).where(eq(volumes.id, id)).limit(1)
  return volume || null
}

export async function listVolumesByProject(projectId: string): Promise<Volume[]> {
  return db
    .select()
    .from(volumes)
    .where(eq(volumes.projectId, projectId))
    .orderBy(asc(volumes.volumeNum))
}

export async function updateVolume(
  id: string,
  data: Partial<Omit<Volume, 'id' | 'createdAt'>>
): Promise<Volume | null> {
  const [volume] = await db.update(volumes).set(data).where(eq(volumes.id, id)).returning()
  return volume || null
}

export async function updateVolumeStatus(id: string, status: VolumeStatus): Promise<void> {
  const updates: Partial<Volume> = { status }
  if (status === 'done') {
    updates.finalizedAt = new Date()
  }
  await db.update(volumes).set(updates).where(eq(volumes.id, id))
}

export async function deleteVolume(id: string): Promise<void> {
  await db.delete(volumes).where(eq(volumes.id, id))
}

export async function getNextVolumeNum(projectId: string): Promise<number> {
  const result = await db
    .select({ maxNum: volumes.volumeNum })
    .from(volumes)
    .where(eq(volumes.projectId, projectId))
    .orderBy(volumes.volumeNum)
  const max = result[result.length - 1]?.maxNum ?? 0
  return max + 1
}
