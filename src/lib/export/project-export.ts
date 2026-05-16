/**
 * Project export per spec 36.
 *
 * Security:
 * - API keys NEVER exported
 * - api_providers exported with display name + type only (no base_url with secrets, no secret_id)
 * - traces default to redact private_layer (caller can opt-in to full)
 *
 * MVP returns a JSON bundle. Full ZIP support can be added with a zip lib.
 */
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db';
import {
  worlds,
  worldlines,
  entities,
  characters,
  memories,
  relationships,
  scenes,
  rounds,
  actions,
  events,
  novelChapters,
  promptVersions,
  embeddingProfiles,
} from '@/db/schema';

export interface ExportOptions {
  worldId: string;
  /** Include private_layer in actions and trace data */
  includePrivate?: boolean;
}

export async function exportProject(opts: ExportOptions): Promise<Record<string, unknown>> {
  const [world] = await db.select().from(worlds).where(eq(worlds.id, opts.worldId));
  if (!world) throw new Error('World not found');

  const [
    wlines,
    ents,
    charRows,
    memRows,
    relRows,
    sceneRows,
    roundRows,
    actionRows,
    eventRows,
    chapterRows,
    promptRows,
    embRows,
  ] = await Promise.all([
    db.select().from(worldlines).where(eq(worldlines.worldId, opts.worldId)),
    db
      .select()
      .from(entities)
      .where(and(eq(entities.worldId, opts.worldId), isNull(entities.deletedAt))),
    db.select().from(characters),
    db.select().from(memories).where(eq(memories.worldId, opts.worldId)),
    db.select().from(relationships).where(eq(relationships.worldId, opts.worldId)),
    db.select().from(scenes).where(eq(scenes.worldId, opts.worldId)),
    db.select().from(rounds).where(eq(rounds.worldId, opts.worldId)),
    db.select().from(actions),
    db.select().from(events).where(eq(events.worldId, opts.worldId)),
    db.select().from(novelChapters).where(eq(novelChapters.worldId, opts.worldId)),
    db.select().from(promptVersions).where(eq(promptVersions.worldId, opts.worldId)),
    db.select().from(embeddingProfiles).where(eq(embeddingProfiles.worldId, opts.worldId)),
  ]);

  // Filter actions to those belonging to this world's scenes
  const sceneIdSet = new Set(sceneRows.map((s) => s.id));
  const sceneActions = actionRows.filter((a) => sceneIdSet.has(a.sceneId));

  // Redact private_layer if not opted in
  const redactedActions = sceneActions.map((a) => {
    if (opts.includePrivate) return a;
    return { ...a, privateLayer: '[REDACTED]', rawModelOutput: '[REDACTED]' };
  });

  // Filter characters to entities in this world
  const charEntityIds = new Set(ents.map((e) => e.id));
  const filteredCharacters = charRows.filter((c) => charEntityIds.has(c.entityId));

  // Redact embedding_profile - keep schema, drop API key (never stored anyway, but be explicit)
  const cleanEmbeddingProfiles = embRows.map((e) => ({
    ...e,
    providerId: null, // sever provider link in export
  }));

  return {
    schema_version: '2.0',
    exported_at: new Date().toISOString(),
    include_private: Boolean(opts.includePrivate),
    world: {
      ...world,
      // Don't export owner_user_id or any secrets
      ownerUserId: '[OWNER]',
    },
    worldlines: wlines,
    entities: ents,
    characters: filteredCharacters,
    embedding_profiles: cleanEmbeddingProfiles,
    prompt_versions: promptRows,
    memories: memRows,
    relationships: relRows,
    scenes: sceneRows,
    rounds: roundRows,
    actions: redactedActions,
    events: eventRows,
    novel_chapters: chapterRows,
  };
}
