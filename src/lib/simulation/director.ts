/**
 * Director directives per spec 28.
 *
 * Soft directives: world_agent may interpret/adjust/delay
 * Hard directives: directly modify world facts/state
 */
import { db } from '@/db';
import { auditLogs, events as eventsTable, memories, scenes } from '@/db/schema';
import { insertMemoryWithEmbedding } from '@/lib/memory/writer';

export type DirectiveType =
  | 'inject_event'
  | 'modify_world_state'
  | 'modify_character_state'
  | 'add_memory'
  | 'reveal_information'
  | 'force_scene'
  | 'create_branch'
  | 'lock_fact'
  | 'adjust_tension'
  | 'approve_memory_write';

export interface Directive {
  worldId: string;
  worldlineId: string;
  directiveType: DirectiveType;
  mode: 'soft' | 'hard';
  content: Record<string, unknown>;
  constraints?: {
    must_not_force_character_reaction?: boolean;
    preserve_character_autonomy?: boolean;
  };
  createdBy: 'user' | 'system';
}

export interface DirectiveResult {
  ok: boolean;
  appliedTo?: string[]; // ids of created/modified resources
  notes?: string[];
}

/**
 * Apply a directive immediately.
 * Soft directives are queued for next world_agent call (we just log them).
 * Hard directives directly mutate state and create audit_log entries.
 */
export async function applyDirective(d: Directive): Promise<DirectiveResult> {
  const notes: string[] = [];
  const applied: string[] = [];

  switch (d.directiveType) {
    case 'inject_event': {
      // Soft event injection: write to events table with public visibility
      const c = d.content as {
        summary?: string;
        target_locations?: string[];
        public_visibility?: string;
        intended_effect?: string;
        scene_id?: string;
      };
      if (!c.summary) {
        return { ok: false, notes: ['inject_event requires summary'] };
      }

      let sceneId = c.scene_id;
      if (!sceneId) {
        // Try latest scene in worldline
        const recentScene = await db.query.scenes?.findFirst?.({
          where: (s, { eq }) => eq(s.worldlineId, d.worldlineId),
          orderBy: (s, { desc }) => desc(s.createdAt),
        });
        sceneId = recentScene?.id;
      }

      const [ev] = await db
        .insert(eventsTable)
        .values({
          worldId: d.worldId,
          worldlineId: d.worldlineId,
          sceneId,
          eventType: 'director_injected',
          canonicalSummary: c.summary,
          publicSummary: c.summary,
          worldTime: { directive_mode: d.mode },
          eventLevel: d.mode === 'hard' ? 'major' : 'meaningful',
          importance: d.mode === 'hard' ? '0.85' : '0.65',
        })
        .returning({ id: eventsTable.id });
      applied.push(ev.id);
      notes.push(
        `Event injected (${d.mode}). Soft mode: world_agent will interpret next round.`,
      );
      break;
    }

    case 'add_memory': {
      const c = d.content as {
        owner_entity_id?: string;
        memory_type?: string;
        visibility?: string;
        content?: string;
        importance?: number;
      };
      if (!c.owner_entity_id || !c.content) {
        return { ok: false, notes: ['add_memory requires owner_entity_id and content'] };
      }
      const memId = await insertMemoryWithEmbedding({
        worldId: d.worldId,
        worldlineId: d.worldlineId,
        ownerEntityId: c.owner_entity_id,
        memoryType: c.memory_type ?? 'episodic',
        content: c.content,
        visibility: c.visibility ?? 'private',
        importance: c.importance ?? 0.7,
        proposedBy: 'director',
        approvalStatus: 'auto_approved',
      });
      applied.push(memId);
      break;
    }

    case 'modify_world_state':
    case 'modify_character_state':
    case 'reveal_information':
    case 'force_scene':
    case 'lock_fact':
    case 'adjust_tension':
    case 'create_branch':
    case 'approve_memory_write':
      notes.push(`Directive type ${d.directiveType} not yet implemented in MVP`);
      break;
  }

  // Audit log per spec 28.3 - hard directives must leave audit trail
  await db.insert(auditLogs).values({
    worldId: d.worldId,
    worldlineId: d.worldlineId,
    auditType: 'director_directive',
    severity: d.mode === 'hard' ? 'warning' : 'info',
    source: d.createdBy,
    description: `${d.directiveType} (${d.mode})`,
    actionTaken: applied.length ? `created ${applied.join(', ')}` : 'none',
    payload: d as unknown as Record<string, unknown>,
  });

  // Suppress unused
  void scenes;
  void memories;

  return { ok: true, appliedTo: applied, notes };
}
