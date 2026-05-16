/**
 * Memory decay job - periodically updates decay_level for active memories
 * based on world day elapsed since creation.
 *
 * Per spec 14.2 / 14.3.
 */
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { memories, worlds } from '@/db/schema';
import { computeDecayLevel } from './decay';

export interface DecayJobResult {
  worldId: string;
  worldlineId: string | null;
  scanned: number;
  updated: number;
}

/**
 * Run decay update for a single worldline.
 * MVP: world_day = days since world.created_at.
 * Production: should use world_state.current_world_day.
 */
export async function runDecayJob(args: {
  worldId: string;
  worldlineId?: string;
  /** Override current world day */
  currentWorldDay?: number;
}): Promise<DecayJobResult> {
  const [world] = await db.select().from(worlds).where(eq(worlds.id, args.worldId));
  if (!world) throw new Error('World not found');

  const currentWorldDay =
    args.currentWorldDay ??
    Math.floor((Date.now() - new Date(world.createdAt).getTime()) / (1000 * 60 * 60 * 24));

  const filters = [eq(memories.worldId, args.worldId), isNull(memories.archivedAt)];
  if (args.worldlineId) filters.push(eq(memories.worldlineId, args.worldlineId));

  const rows = await db
    .select({
      id: memories.id,
      memoryType: memories.memoryType,
      importance: memories.importance,
      emotionalWeight: memories.emotionalWeight,
      reinforcementCount: memories.reinforcementCount,
      truthStatus: memories.truthStatus,
      createdAt: memories.createdAt,
    })
    .from(memories)
    .where(and(...filters));

  let updated = 0;
  for (const r of rows) {
    const createdWorldDay = Math.floor(
      (new Date(r.createdAt).getTime() - new Date(world.createdAt).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const decay = computeDecayLevel({
      memoryType: r.memoryType,
      createdWorldDay,
      currentWorldDay,
      importance: Number(r.importance),
      emotionalWeight: Number(r.emotionalWeight),
      reinforcementCount: r.reinforcementCount,
      truthStatus: r.truthStatus,
    });
    await db
      .update(memories)
      .set({ decayLevel: decay.toFixed(3) })
      .where(eq(memories.id, r.id));
    updated++;
  }

  return {
    worldId: args.worldId,
    worldlineId: args.worldlineId ?? null,
    scanned: rows.length,
    updated,
  };
}
