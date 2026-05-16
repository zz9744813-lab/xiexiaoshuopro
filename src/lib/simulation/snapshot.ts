/**
 * Snapshot creation per spec 22.3.
 *
 * Snapshots are created at:
 * - scene_start
 * - scene_end
 * - worldline_fork (parent + child both)
 * - user_checkpoint
 *
 * Round-level rollback uses DB transaction ROLLBACK, NOT a snapshot.
 */
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db';
import {
  snapshots,
  entities,
  characters as charactersTable,
  memories,
  relationships,
  scenes,
} from '@/db/schema';
import { createHash } from 'node:crypto';

export interface SnapshotInput {
  worldId: string;
  worldlineId: string;
  snapshotType: 'scene_start' | 'scene_end' | 'worldline_fork' | 'user_checkpoint';
  sceneId?: string;
  roundId?: string;
  parentSnapshotId?: string;
  /** Optional pre-built blob; if not provided, will collect from DB */
  stateBlob?: Record<string, unknown>;
}

const SNAPSHOT_MAX_BYTES =
  Number(process.env.SNAPSHOT_MAX_MB ?? 50) * 1024 * 1024;
const SNAPSHOT_HARD_LIMIT_BYTES = 200 * 1024 * 1024;

/**
 * Collect a worldline's active state into a JSONB blob.
 * Per spec 22.5 - exclude raw trace, archived memories, novel chapters, raw outputs.
 */
async function collectWorldlineState(
  worldId: string,
  worldlineId: string,
): Promise<Record<string, unknown>> {
  const [ents, chars, mems, rels, scns] = await Promise.all([
    db.select().from(entities).where(and(eq(entities.worldId, worldId), isNull(entities.deletedAt))),
    db
      .select()
      .from(charactersTable)
      .innerJoin(entities, eq(charactersTable.entityId, entities.id))
      .where(eq(entities.worldId, worldId)),
    db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.worldlineId, worldlineId),
          isNull(memories.archivedAt),
          isNull(memories.deletedAt),
        ),
      ),
    db.select().from(relationships).where(eq(relationships.worldlineId, worldlineId)),
    db.select().from(scenes).where(eq(scenes.worldlineId, worldlineId)),
  ]);

  return {
    entities: ents,
    characters: chars,
    active_memories: mems,
    relationships: rels,
    scenes: scns,
  };
}

export async function createSnapshot(input: SnapshotInput): Promise<{
  snapshotId: string;
  sizeBytes: number;
  warning?: string;
}> {
  const blob = input.stateBlob ?? (await collectWorldlineState(input.worldId, input.worldlineId));
  const json = JSON.stringify(blob);
  const sizeBytes = Buffer.byteLength(json, 'utf8');

  if (sizeBytes > SNAPSHOT_HARD_LIMIT_BYTES) {
    throw new Error(
      `Snapshot size ${sizeBytes} > 200MB hard limit. Use incremental strategy instead.`,
    );
  }

  const stateHash = createHash('sha256').update(json).digest('hex');

  const [row] = await db
    .insert(snapshots)
    .values({
      worldId: input.worldId,
      worldlineId: input.worldlineId,
      snapshotType: input.snapshotType,
      sceneId: input.sceneId,
      roundId: input.roundId,
      parentSnapshotId: input.parentSnapshotId,
      stateBlob: blob,
      stateHash,
      sizeBytes,
    })
    .returning({ id: snapshots.id });

  const warning =
    sizeBytes > SNAPSHOT_MAX_BYTES
      ? `Snapshot ${(sizeBytes / 1024 / 1024).toFixed(1)} MB exceeds soft limit (${SNAPSHOT_MAX_MB} MB). Consider switching to incremental snapshots.`
      : undefined;

  return { snapshotId: row.id, sizeBytes, warning };
}

const SNAPSHOT_MAX_MB = Number(process.env.SNAPSHOT_MAX_MB ?? 50);

/** Restore world state from a snapshot (placeholder - production needs careful tx ordering). */
export async function loadSnapshot(snapshotId: string): Promise<Record<string, unknown> | null> {
  const [row] = await db.select().from(snapshots).where(eq(snapshots.id, snapshotId));
  if (!row) return null;
  return row.stateBlob as Record<string, unknown>;
}
