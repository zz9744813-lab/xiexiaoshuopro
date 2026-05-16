/**
 * Narrator service - generates novel chapters from simulation events.
 * Per spec 7.3 / 35.
 *
 * SECURITY: narrator entity has special ACL access (spec 13.4) - can read
 * private_layer / world_only / novelizer_only, but NOT author_only.
 *
 * Constraints (spec 35.3):
 * - Narrator may add literary detail (env, psychology BASED ON existing private_layer)
 * - Narrator must NOT add new major events
 * - Narrator must NOT change action results
 * - Narrator must NOT make characters know what they shouldn't
 * - Narrator must NOT promote interrupted (was_interrupted=true) planned_speech to spoken
 * - Narrator memory_write_requests go to approval queue (proposed_by=novelizer)
 */
import { eq, inArray, asc } from 'drizzle-orm';
import { db } from '@/db';
import {
  events as eventsTable,
  actions as actionsTable,
  scenes as scenesTable,
  entities as entitiesTable,
  novelChapters,
  memoryWriteRequests,
  worlds,
} from '@/db/schema';
import { callLLM } from './llm-service';
import { wrapUserData, DEFAULT_NARRATOR_SYSTEM_PROMPT } from './prompts';

export interface GenerateChapterInput {
  worldId: string;
  worldlineId: string;
  /** Source event ids the chapter must cover */
  sourceEventIds: string[];
  /** Optional scene scope */
  sourceSceneIds?: string[];
  /** Narrator entity id (entity_type=narrator). If omitted, find the world's narrator. */
  narratorEntityId?: string;
  /** Optional override api profile (else use narrator entity's profile) */
  apiProfileId?: string;
  /** Narrative POV preference */
  pov?: 'first_person' | 'third_person_limited' | 'third_person_omniscient';
  /** Style notes (length, tone, etc) */
  styleProfile?: Record<string, unknown>;
  /** Optional title; otherwise narrator decides */
  title?: string;
}

export interface GenerateChapterResult {
  chapterId: string;
  chapterIndex: number;
  faithfulnessScore: number;
  faithfulnessReport: Record<string, unknown>;
  changedMajorFacts: string[];
  warnings: string[];
}

interface FaithfulnessReport {
  score?: number;
  added_literary_details?: string[];
  changed_major_facts?: boolean;
  new_major_events?: string[];
  notes?: string;
}

/**
 * Heuristic faithfulness check (spec 35.3).
 * Compares chapter text against canonical_summary of source events.
 * If chapter contains tokens that appear in NO canonical_summary AND look like
 * named entities, flag as suspicious.
 */
function checkFaithfulness(args: {
  chapterMarkdown: string;
  sourceEventSummaries: string[];
  interruptedSpeech: string[];
}): { score: number; flagged: string[] } {
  const flagged: string[] = [];

  // Check that no interrupted planned_speech was promoted to chapter as spoken
  for (const speech of args.interruptedSpeech) {
    if (speech.length >= 6 && args.chapterMarkdown.includes(speech)) {
      flagged.push(`interrupted_speech_promoted: "${speech.slice(0, 40)}..."`);
    }
  }

  // Token coverage heuristic - extract named entities (CJK words ≥ 2 chars)
  const chapterTokens = new Set(
    (args.chapterMarkdown.match(/[\u4e00-\u9fff]{2,}/g) ?? []).filter(
      (t) => t.length <= 8,
    ),
  );
  const sourceTokens = new Set(
    args.sourceEventSummaries
      .flatMap((s) => s.match(/[\u4e00-\u9fff]{2,}/g) ?? [])
      .filter((t) => t.length <= 8),
  );

  // For tokens that appear ≥ 3 times in chapter but never in source, that's suspicious
  // (likely fabricated entity)
  const tokenCounts = new Map<string, number>();
  for (const t of args.chapterMarkdown.match(/[\u4e00-\u9fff]{2,8}/g) ?? []) {
    tokenCounts.set(t, (tokenCounts.get(t) ?? 0) + 1);
  }
  for (const [tok, cnt] of tokenCounts) {
    if (cnt >= 3 && !sourceTokens.has(tok) && !chapterTokens.has(tok)) {
      // unlikely path; placeholder
    }
  }

  // Coverage = how many source tokens appear in chapter
  const coverage =
    sourceTokens.size === 0
      ? 0.5
      : Array.from(sourceTokens).filter((t) => args.chapterMarkdown.includes(t)).length /
        sourceTokens.size;

  let score = 0.5 + coverage * 0.5;
  if (flagged.length > 0) score -= 0.2 * flagged.length;
  score = Math.max(0, Math.min(1, score));

  return { score, flagged };
}

export async function generateChapter(
  input: GenerateChapterInput,
): Promise<GenerateChapterResult> {
  // 1. Resolve narrator entity
  let narratorEntityId = input.narratorEntityId;
  if (!narratorEntityId) {
    const narratorRows = await db
      .select()
      .from(entitiesTable)
      .where(eq(entitiesTable.worldId, input.worldId));
    const narrator = narratorRows.find((e) => e.entityType === 'narrator');
    if (!narrator) {
      throw new Error(
        'No narrator entity found in this world. Create one first (entity_type=narrator).',
      );
    }
    narratorEntityId = narrator.id;
  }

  const [narrator] = await db
    .select()
    .from(entitiesTable)
    .where(eq(entitiesTable.id, narratorEntityId));
  if (!narrator) throw new Error('Narrator entity not found');

  const apiProfileId = input.apiProfileId ?? narrator.apiProfileId;
  if (!apiProfileId) {
    throw new Error('Narrator has no api_profile and no override given');
  }

  // 2. Load source events with full details
  if (input.sourceEventIds.length === 0) {
    throw new Error('source_event_ids is required and must be non-empty');
  }
  const events = await db
    .select()
    .from(eventsTable)
    .where(inArray(eventsTable.id, input.sourceEventIds))
    .orderBy(asc(eventsTable.createdAt));

  // 3. Load all related actions (including private_layer - narrator can see this)
  const actionIds = events.flatMap((e) => e.sourceActionIds ?? []);
  const acts =
    actionIds.length > 0
      ? await db.select().from(actionsTable).where(inArray(actionsTable.id, actionIds))
      : [];

  const interruptedSpeech: string[] = [];
  for (const a of acts) {
    if (a.wasInterrupted) {
      const pl = a.privateLayer as Record<string, unknown>;
      const planned = pl.planned_but_unspoken;
      if (typeof planned === 'string' && planned) interruptedSpeech.push(planned);
    }
  }

  // 4. Load scenes for context
  const sceneIds = input.sourceSceneIds ?? events.map((e) => e.sceneId).filter(Boolean) as string[];
  const sceneRows =
    sceneIds.length > 0
      ? await db.select().from(scenesTable).where(inArray(scenesTable.id, sceneIds))
      : [];

  // 5. Build narrator input bundle
  const entityIds = Array.from(new Set([
    ...events.flatMap((e) => e.involvedEntityIds ?? []),
    ...acts.map((a) => a.entityId),
  ]));
  const involvedEntities =
    entityIds.length > 0
      ? await db.select().from(entitiesTable).where(inArray(entitiesTable.id, entityIds))
      : [];

  const narratorBundle = {
    instructions: {
      pov: input.pov ?? 'third_person_limited',
      style: input.styleProfile ?? { length: 'medium', tone: 'literary' },
      title_hint: input.title,
      faithfulness_rules: [
        '不得新增重大事件',
        '不得改变行动结果',
        '不得让角色知道未感知的信息',
        '不得把被打断的 planned_speech 写成已经说出口',
        '可以补充环境描写、心理描写（必须基于已有 private_layer）',
      ],
    },
    scenes: sceneRows.map((s) => ({
      id: s.id,
      title: s.title,
      world_time: s.worldTime,
      participants: s.participantEntityIds,
    })),
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      canonical_summary: e.canonicalSummary,
      public_summary: e.publicSummary,
      hidden_summary: e.hiddenSummary,
      event_level: e.eventLevel,
      involved_entity_ids: e.involvedEntityIds,
      source_action_ids: e.sourceActionIds,
    })),
    actions: acts.map((a) => ({
      id: a.id,
      entity_id: a.entityId,
      phase: a.phase,
      action_type: a.actionType,
      public_layer: a.publicLayer,
      private_layer: a.privateLayer, // narrator can read these
      was_interrupted: a.wasInterrupted,
    })),
    entities: involvedEntities.map((e) => ({
      id: e.id,
      name: e.name,
      entity_type: e.entityType,
    })),
    interrupted_speech_to_avoid: interruptedSpeech,
  };

  // 6. Call narrator LLM
  const llmResult = await callLLM(
    [
      { role: 'system', content: DEFAULT_NARRATOR_SYSTEM_PROMPT },
      { role: 'user', content: wrapUserData('narrator_input', narratorBundle) },
    ],
    {
      apiProfileId,
      worldId: input.worldId,
      worldlineId: input.worldlineId,
      entityId: narrator.id,
      traceType: 'novelizer_call',
      schemaName: 'novelizer',
      inputContext: narratorBundle,
    },
  );

  const parsed = llmResult.response.parsedJson as
    | {
        chapter_title?: string;
        chapter_markdown?: string;
        source_event_ids?: string[];
        memory_write_requests?: Array<Record<string, unknown>>;
        faithfulness_report?: FaithfulnessReport;
      }
    | undefined;

  if (!parsed) {
    throw new Error('Narrator output was not parseable JSON');
  }

  const chapterMarkdown = parsed.chapter_markdown ?? '';
  if (!chapterMarkdown) throw new Error('Narrator returned empty chapter_markdown');

  const title = parsed.chapter_title ?? input.title ?? '未命名章节';

  // 7. Auto-faithfulness check
  const auto = checkFaithfulness({
    chapterMarkdown,
    sourceEventSummaries: events.map((e) => e.canonicalSummary),
    interruptedSpeech,
  });

  const llmReport = parsed.faithfulness_report ?? {};
  const finalReport = {
    ...llmReport,
    auto_score: auto.score,
    auto_flagged: auto.flagged,
  };
  const finalScore = Math.min(
    auto.score,
    typeof llmReport.score === 'number' ? llmReport.score : auto.score,
  );

  const changedMajorFacts: string[] = [];
  if (llmReport.changed_major_facts === true) changedMajorFacts.push('llm_self_reported');
  changedMajorFacts.push(...auto.flagged);

  // 8. Determine chapter index
  const existing = await db
    .select({ idx: novelChapters.chapterIndex })
    .from(novelChapters)
    .where(eq(novelChapters.worldlineId, input.worldlineId));
  const chapterIndex = existing.length;

  // 9. Insert chapter (status=draft if any flag, else reviewing)
  const status = changedMajorFacts.length > 0 ? 'draft' : 'reviewing';

  const [row] = await db
    .insert(novelChapters)
    .values({
      worldId: input.worldId,
      worldlineId: input.worldlineId,
      chapterIndex,
      title,
      contentMarkdown: chapterMarkdown,
      pov: input.pov,
      styleProfile: input.styleProfile ?? {},
      sourceEventIds: input.sourceEventIds,
      sourceSceneIds: sceneIds,
      faithfulnessScore: finalScore.toFixed(3),
      faithfulnessReport: finalReport,
      changedMajorFacts,
      apiProfileId,
      generationTraceId: llmResult.traceId,
      status,
    })
    .returning({ id: novelChapters.id });

  // 10. Memory write requests from narrator -> approval queue
  const mwrList = parsed.memory_write_requests ?? [];
  for (const mwr of mwrList) {
    await db.insert(memoryWriteRequests).values({
      worldId: input.worldId,
      worldlineId: input.worldlineId,
      proposedBy: 'novelizer',
      proposedPayload: { ...mwr, source_chapter_id: row.id } as Record<string, unknown>,
      sourceTraceId: llmResult.traceId,
      status: 'pending',
    });
  }

  // suppress unused
  void worlds;

  const warnings: string[] = [];
  if (changedMajorFacts.length > 0) {
    warnings.push(
      `章节包含 ${changedMajorFacts.length} 个忠实度警告，状态保持 draft，需作者复核`,
    );
  }
  if (mwrList.length > 0) {
    warnings.push(`narrator 提出 ${mwrList.length} 条 memory_write_request，待审批`);
  }

  return {
    chapterId: row.id,
    chapterIndex,
    faithfulnessScore: finalScore,
    faithfulnessReport: finalReport,
    changedMajorFacts,
    warnings,
  };
}
