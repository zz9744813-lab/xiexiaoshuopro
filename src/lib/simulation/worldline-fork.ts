/**
 * Worldline fork per spec 23.1.
 *
 * MVP: deep copy of active core state.
 * Active memories, relationships are deep-copied (new ids, new worldline_id).
 * Scenes/rounds/actions/events are NOT copied - new worldline starts fresh
 * from the fork point.
 */
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { worldlines, memories, relationships } from '@/db/schema';
import { createSnapshot } from './snapshot';

export interface ForkInput {
  worldId: string;
  parentWorldlineId: string;
  name: string;
  branchReason?: string;
  /** scene_id at which fork happened (for snapshot context) */
  sceneId?: string;
}

export interface ForkResult {
  childWorldlineId: string;
  parentSnapshotId: string;
  childSnapshotId: string;
  copiedMemories: number;
  copiedRelationships: number;
}

export async function forkWorldline(input: ForkInput): Promise<ForkResult> {
  return await db.transaction(async (tx) => {
    const [parent] = await tx
      .select()
      .from(worldlines)
      .where(eq(worldlines.id, input.parentWorldlineId));
    if (!parent) throw new Error('Parent worldline not found');

    // 1. Create child worldline
    const [child] = await tx
      .insert(worldlines)
      .values({
        worldId: input.worldId,
        parentWorldlineId: input.parentWorldlineId,
        name: input.name,
        branchReason: input.branchReason,
        status: 'active',
        lineageDepth: parent.lineageDepth + 1,
      })
      .returning();

    // 2. Deep-copy active memories
    const parentMems = await tx
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.worldlineId, input.parentWorldlineId),
          isNull(memories.archivedAt),
          isNull(memories.deletedAt),
        ),
      );

    let copiedMemories = 0;
    if (parentMems.length > 0) {
      const newRows = parentMems.map((m) => ({
        worldId: m.worldId,
        worldlineId: child.id,
        ownerEntityId: m.ownerEntityId,
        memoryType: m.memoryType,
        content: m.content,
        summary: m.summary,
        visibility: m.visibility,
        allowedEntities: m.allowedEntities,
        deniedEntities: m.deniedEntities,
        allowedFactions: m.allowedFactions,
        truthStatus: m.truthStatus,
        confidence: m.confidence,
        importance: m.importance,
        emotionalWeight: m.emotionalWeight,
        decayLevel: m.decayLevel,
        reinforcementCount: m.reinforcementCount,
        proposedBy: m.proposedBy,
        approvalStatus: m.approvalStatus,
        sourceMemoryId: m.id, // link back to parent line memory
        embedding: m.embedding,
        tags: m.tags,
      }));
      // Batch insert in chunks of 200 to avoid PG parameter limits
      for (let i = 0; i < newRows.length; i += 200) {
        await tx.insert(memories).values(newRows.slice(i, i + 200));
      }
      copiedMemories = newRows.length;
    }

    // 3. Deep-copy relationships
    const parentRels = await tx
      .select()
      .from(relationships)
      .where(eq(relationships.worldlineId, input.parentWorldlineId));

    let copiedRelationships = 0;
    if (parentRels.length > 0) {
      const newRows = parentRels.map((r) => ({
        worldId: r.worldId,
        worldlineId: child.id,
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
        notes: r.notes,
        lastEventId: r.lastEventId,
      }));
      await tx.insert(relationships).values(newRows);
      copiedRelationships = newRows.length;
    }

    // Return placeholder snapshots; we create them after tx since they read state
    return {
      childWorldlineId: child.id,
      parentSnapshotId: '',
      childSnapshotId: '',
      copiedMemories,
      copiedRelationships,
    };
  }).then(async (txResult) => {
    // 4. Create snapshots for both worldlines (post-tx so they see committed state)
    const [parentSnap, childSnap] = await Promise.all([
      createSnapshot({
        worldId: input.worldId,
        worldlineId: input.parentWorldlineId,
        snapshotType: 'worldline_fork',
        sceneId: input.sceneId,
      }),
      createSnapshot({
        worldId: input.worldId,
        worldlineId: txResult.childWorldlineId,
        snapshotType: 'worldline_fork',
        sceneId: input.sceneId,
      }),
    ]);

    return {
      ...txResult,
      parentSnapshotId: parentSnap.snapshotId,
      childSnapshotId: childSnap.snapshotId,
    };
  });
}
