/**
 * Snapshot creation + restoration per spec § 22.3 / § 22.4-22.6.
 *
 * Snapshots are created at:
 * - scene_start
 * - scene_end
 * - worldline_fork (parent + child both)
 * - user_checkpoint
 *
 * Round-level rollback uses DB transaction ROLLBACK, NOT a snapshot.
 *
 * Restoration: hard-deletes worldline data created AFTER the snapshot, then
 * upserts memories/relationships from the blob to bring state back. All in
 * a single transaction.
 */
import { eq, and, isNull, gt, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  snapshots,
  entities,
  characters as charactersTable,
  memories,
  relationships,
  scenes,
  rounds,
  actions,
  events as eventsTable,
  eventLogs,
  auditLogs,
} from '@/db/schema';
import { createHash } from 'node:crypto';

export interface SnapshotInput {
  worldId: string;
  worldlineId: string;
  snapshotType: 'scene_start' | 'scene_end' | 'worldline_fork' | 'user_checkpoint';
  sceneId?: string;
  roundId?: string;
  parentSnapshotId?: string;
  stateBlob?: Record<string, unknown>;
}

const SNAPSHOT_MAX_MB = Number(process.env.SNAPSHOT_MAX_MB ?? 50);
const SNAPSHOT_MAX_BYTES = SNAPSHOT_MAX_MB * 1024 * 1024;
const SNAPSHOT_HARD_LIMIT_BYTES = 200 * 1024 * 1024;

async function collectWorldlineState(
  worldId: string,
  worldlineId: string,
): Promise<Record<string, unknown>> {
  const [ents, chars, mems, rels, scns] = await Promise.all([
    db
      .select()
      .from(entities)
      .where(and(eq(entities.worldId, worldId), isNull(entities.deletedAt))),
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
  const blob =
    input.stateBlob ?? (await collectWorldlineState(input.worldId, input.worldlineId));
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
      ? `Snapshot ${(sizeBytes / 1024 / 1024).toFixed(
          1,
        )} MB exceeds soft limit (${SNAPSHOT_MAX_MB} MB). Consider switching to incremental snapshots.`
      : undefined;

  return { snapshotId: row.id, sizeBytes, warning };
}

/** Returns the raw state_blob for a snapshot. */
export async function loadSnapshot(
  snapshotId: string,
): Promise<Record<string, unknown> | null> {
  const [row] = await db.select().from(snapshots).where(eq(snapshots.id, snapshotId));
  if (!row) return null;
  return row.stateBlob as Record<string, unknown>;
}

export interface RestoreResult {
  worldlineId: string;
  restoredMemories: number;
  restoredRelationships: number;
  rolledBackRounds: number;
  rolledBackActions: number;
  rolledBackEvents: number;
  scenesRolledBack: number;
}

interface MemorySnapshotRow {
  id: string;
  worldId: string;
  worldlineId: string;
  ownerEntityId: string;
  memoryType: string;
  content: string;
  summary?: string | null;
  visibility: string;
  allowedEntities?: string[];
  deniedEntities?: string[];
  allowedFactions?: string[];
  truthStatus?: string;
  confidence?: string;
  importance?: string;
  emotionalWeight?: string;
  decayLevel?: string;
  reinforcementCount?: number;
  proposedBy?: string;
  approvalStatus?: string;
  tags?: string[];
}

interface RelationshipSnapshotRow {
  id: string;
  worldId: string;
  worldlineId: string;
  sourceEntityId: string;
  targetEntityId: string;
  trust: string;
  suspicion: string;
  attraction: string;
  fear: string;
  guilt: string;
  dependence: string;
  curiosity: string;
  hostility: string;
  protectiveness: string;
  controlDesire: string;
  notes?: string | null;
}

/**
 * Restore the worldline to the state captured by a snapshot.
 *
 * Steps (all in one transaction):
 * 1. Load snapshot, validate worldline match
 * 2. Hard-delete rounds/actions/events/event_logs created AFTER snapshot.created_at
 *    (these are worldline-local and cannot leak across worldlines)
 * 3. Memories created AFTER snapshot.created_at: hard-delete
 * 4. Memories present in snapshot: upsert their importance/decay/etc back
 * 5. Memories that exist in DB but NOT in snapshot (and were created BEFORE the
 *    snapshot but ARCHIVED after): un-archive them by clearing archived_at
 * 6. Relationships: upsert from snapshot; delete relationships that exist now
 *    but didn't exist in the snapshot
 * 7. Scenes that started AFTER the snapshot and are not committed: status=rolled_back
 * 8. Write an audit_logs entry
 */
export async function restoreSnapshotToWorldline(
  snapshotId: string,
): Promise<RestoreResult> {
  return await db.transaction(async (tx) => {
    const [snap] = await tx.select().from(snapshots).where(eq(snapshots.id, snapshotId));
    if (!snap) throw new Error(`Snapshot ${snapshotId} not found`);

    const cutoff = snap.createdAt;
    const blob = snap.stateBlob as Record<string, unknown>;
    const snapMems = (blob.active_memories ?? []) as MemorySnapshotRow[];
    const snapRels = (blob.relationships ?? []) as RelationshipSnapshotRow[];

    const worldlineId = snap.worldlineId;

    // 2. Hard-delete worldline-local data created AFTER cutoff.
    // Order: event_logs → events → actions → rounds → scenes (referential)
    const futureRounds = await tx
      .select({ id: rounds.id })
      .from(rounds)
      .where(and(eq(rounds.worldlineId, worldlineId), gt(rounds.createdAt, cutoff)));
    const futureRoundIds = futureRounds.map((r) => r.id);

    const futureEvents = await tx
      .select({ id: eventsTable.id })
      .from(eventsTable)
      .where(and(eq(eventsTable.worldlineId, worldlineId), gt(eventsTable.createdAt, cutoff)));
    const futureEventIds = futureEvents.map((e) => e.id);

    let rolledBackEvents = 0;
    if (futureEventIds.length > 0) {
      await tx.delete(eventLogs).where(inArray(eventLogs.eventId, futureEventIds));
      const del = await tx.delete(eventsTable).where(inArray(eventsTable.id, futureEventIds));
      rolledBackEvents = futureEventIds.length;
      void del;
    }

    let rolledBackActions = 0;
    if (futureRoundIds.length > 0) {
      const acts = await tx
        .select({ id: actions.id })
        .from(actions)
        .where(inArray(actions.roundId, futureRoundIds));
      rolledBackActions = acts.length;
      if (acts.length > 0) {
        await tx.delete(actions).where(inArray(actions.id, acts.map((a) => a.id)));
      }
      await tx.delete(rounds).where(inArray(rounds.id, futureRoundIds));
    }

    // Scenes: those started AFTER cutoff and not yet committed → mark rolled_back
    const futureScenes = await tx
      .select({ id: scenes.id, status: scenes.status })
      .from(scenes)
      .where(and(eq(scenes.worldlineId, worldlineId), gt(scenes.createdAt, cutoff)));
    let scenesRolledBack = 0;
    for (const s of futureScenes) {
      if (s.status !== 'committed' && s.status !== 'completed') {
        await tx.update(scenes).set({ status: 'rolled_back' }).where(eq(scenes.id, s.id));
        scenesRolledBack++;
      }
    }

    // 3. Memories created AFTER cutoff → hard-delete
    await tx
      .delete(memories)
      .where(and(eq(memories.worldlineId, worldlineId), gt(memories.createdAt, cutoff)));

    // 4. Upsert snapshot memories: keys by id (they're worldline-local so id is stable)
    let restoredMemories = 0;
    for (const m of snapMems) {
      // Update if exists; insert if missing (e.g. if user hard-deleted via UI)
      const [existing] = await tx
        .select({ id: memories.id })
        .from(memories)
        .where(eq(memories.id, m.id));
      if (existing) {
        await tx
          .update(memories)
          .set({
            content: m.content,
            summary: m.summary ?? null,
            visibility: m.visibility,
            importance: m.importance ?? '0.500',
            emotionalWeight: m.emotionalWeight ?? '0.000',
            decayLevel: m.decayLevel ?? '0.000',
            reinforcementCount: m.reinforcementCount ?? 0,
            truthStatus: m.truthStatus ?? 'subjective',
            archivedAt: null, // un-archive if was archived after snapshot
            deletedAt: null,
          })
          .where(eq(memories.id, m.id));
      } else {
        await tx.insert(memories).values({
          id: m.id,
          worldId: m.worldId,
          worldlineId: m.worldlineId,
          ownerEntityId: m.ownerEntityId,
          memoryType: m.memoryType,
          content: m.content,
          summary: m.summary ?? null,
          visibility: m.visibility,
          allowedEntities: m.allowedEntities ?? [],
          deniedEntities: m.deniedEntities ?? [],
          allowedFactions: m.allowedFactions ?? [],
          truthStatus: m.truthStatus ?? 'subjective',
          confidence: m.confidence ?? '1.000',
          importance: m.importance ?? '0.500',
          emotionalWeight: m.emotionalWeight ?? '0.000',
          decayLevel: m.decayLevel ?? '0.000',
          reinforcementCount: m.reinforcementCount ?? 0,
          proposedBy: m.proposedBy ?? 'character_self',
          approvalStatus: m.approvalStatus ?? 'auto_approved',
          tags: m.tags ?? [],
        });
      }
      restoredMemories++;
    }

    // 6. Relationships: upsert from snapshot; delete extras
    const snapRelIds = new Set(snapRels.map((r) => r.id));
    const currentRels = await tx
      .select({ id: relationships.id })
      .from(relationships)
      .where(eq(relationships.worldlineId, worldlineId));
    const toDelete = currentRels.filter((r) => !snapRelIds.has(r.id)).map((r) => r.id);
    if (toDelete.length > 0) {
      await tx.delete(relationships).where(inArray(relationships.id, toDelete));
    }
    let restoredRelationships = 0;
    for (const r of snapRels) {
      const [existing] = await tx
        .select({ id: relationships.id })
        .from(relationships)
        .where(eq(relationships.id, r.id));
      if (existing) {
        await tx
          .update(relationships)
          .set({
            trust: r.trust,
            suspicion: r.suspicion,
            attraction: r.attraction,
            fear: r.fear,
            guilt: r.guilt,
            dependence: r.dependence,
            curiosity: r.curiosity,
            hostility: r.hostility,
            protectiveness: r.protectiveness,
            controlDesire: r.controlDesire,
            notes: r.notes ?? null,
          })
          .where(eq(relationships.id, r.id));
      } else {
        await tx.insert(relationships).values({
          id: r.id,
          worldId: r.worldId,
          worldlineId: r.worldlineId,
          sourceEntityId: r.sourceEntityId,
          targetEntityId: r.targetEntityId,
          trust: r.trust,
          suspicion: r.suspicion,
          attraction: r.attraction,
          fear: r.fear,
          guilt: r.guilt,
          dependence: r.dependence,
          curiosity: r.curiosity,
          hostility: r.hostility,
          protectiveness: r.protectiveness,
          controlDesire: r.controlDesire,
          notes: r.notes ?? null,
        });
      }
      restoredRelationships++;
    }

    // 8. Audit log
    await tx.insert(auditLogs).values({
      worldId: snap.worldId,
      worldlineId,
      auditType: 'snapshot_restore',
      severity: 'info',
      source: 'user',
      description: `Restored to snapshot ${snapshotId} (${snap.snapshotType})`,
      actionTaken: `rolled_back ${futureRoundIds.length} rounds`,
      payload: {
        snapshot_id: snapshotId,
        rolled_back_rounds: futureRoundIds.length,
        rolled_back_actions: rolledBackActions,
        rolled_back_events: rolledBackEvents,
        restored_memories: restoredMemories,
        restored_relationships: restoredRelationships,
      } as Record<string, unknown>,
    });

    return {
      worldlineId,
      restoredMemories,
      restoredRelationships,
      rolledBackRounds: futureRoundIds.length,
      rolledBackActions,
      rolledBackEvents,
      scenesRolledBack,
    };
  });
}
