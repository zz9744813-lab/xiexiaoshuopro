/**
 * Idempotent seed script for spec v2.0 demo data.
 *
 * Creates a complete world with:
 *  - 1 world + main worldline
 *  - 3 prompt versions (character / world_agent / novelizer) from prompts.ts constants
 *  - 1 embedding profile (text-embedding-3-small @ 1536-dim)
 *  - 2 api_providers: mock (no key), openai (placeholder key for demo)
 *  - 3 api_profiles: character_default / world_agent_default / narrator_default → all point to mock
 *  - 1 world_agent + 1 narrator + 2 characters (沈鸢, 林澈) with full profiles
 *  - relationships between the two characters
 *  - 5-10 initial memories per character (mix of private/public/shared)
 *  - 1 pending scene with both characters as participants
 *
 * Idempotency: each insert is keyed by a stable name + worldId tuple. Re-running
 * skips existing rows. Safe to run multiple times.
 *
 * Usage:
 *   npm run db:seed
 */
import 'dotenv/config';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import {
  worlds,
  worldlines,
  promptVersions,
  embeddingProfiles,
  apiProviders,
  apiProfiles,
  entities,
  characters,
  relationships,
  memories,
  scenes,
} from '@/db/schema';
import {
  DEFAULT_CHARACTER_SYSTEM_PROMPT,
  DEFAULT_WORLD_AGENT_SYSTEM_PROMPT,
  DEFAULT_NARRATOR_SYSTEM_PROMPT,
} from '@/lib/simulation/prompts';
import { encryptSecret } from '@/lib/security/crypto';

const OWNER_USER_ID = '00000000-0000-0000-0000-000000000001';

async function findOrCreate<T>(
  find: () => Promise<T | undefined>,
  create: () => Promise<T>,
): Promise<T> {
  const existing = await find();
  if (existing) return existing;
  return await create();
}

async function main() {
  console.log('▶ Starting seed...');

  // ---- 1. World ----
  const world = await findOrCreate(
    async () => {
      const [w] = await db
        .select()
        .from(worlds)
        .where(and(eq(worlds.name, '雾城试验场'), eq(worlds.ownerUserId, OWNER_USER_ID)));
      return w;
    },
    async () => {
      const [w] = await db
        .insert(worlds)
        .values({
          name: '雾城试验场',
          description:
            '一座封闭的多势力古城，钟楼顶端有不为人知的秘密。两位主角的命运在地下酒馆短暂交汇。',
          genre: '悬疑·仙侠混合',
          ownerUserId: OWNER_USER_ID,
        })
        .returning();
      console.log('  ✓ Created world');
      return w;
    },
  );

  // ---- 2. Worldline ----
  const worldline = await findOrCreate(
    async () => {
      const [w] = await db
        .select()
        .from(worldlines)
        .where(and(eq(worldlines.worldId, world.id), eq(worldlines.name, 'main')));
      return w;
    },
    async () => {
      const [w] = await db
        .insert(worldlines)
        .values({ worldId: world.id, name: 'main', status: 'active' })
        .returning();
      console.log('  ✓ Created main worldline');
      return w;
    },
  );

  // Update world.default_worldline_id
  if (!world.defaultWorldlineId) {
    await db
      .update(worlds)
      .set({ defaultWorldlineId: worldline.id })
      .where(eq(worlds.id, world.id));
  }

  // ---- 3. Prompt versions ----
  type PromptKind = {
    name: string;
    promptType: string;
    content: string;
    versionField: 'defaultCharacterPromptVersionId' | 'worldAgentPromptVersionId' | 'novelizerPromptVersionId';
  };
  const promptKinds: PromptKind[] = [
    {
      name: 'character_default',
      promptType: 'character_system',
      content: DEFAULT_CHARACTER_SYSTEM_PROMPT,
      versionField: 'defaultCharacterPromptVersionId',
    },
    {
      name: 'world_agent_default',
      promptType: 'world_agent_system',
      content: DEFAULT_WORLD_AGENT_SYSTEM_PROMPT,
      versionField: 'worldAgentPromptVersionId',
    },
    {
      name: 'novelizer_default',
      promptType: 'novelizer_system',
      content: DEFAULT_NARRATOR_SYSTEM_PROMPT,
      versionField: 'novelizerPromptVersionId',
    },
  ];

  for (const pk of promptKinds) {
    const existing = await db
      .select()
      .from(promptVersions)
      .where(and(eq(promptVersions.worldId, world.id), eq(promptVersions.name, pk.name)));
    let row = existing[0];
    if (!row) {
      [row] = await db
        .insert(promptVersions)
        .values({
          ownerUserId: OWNER_USER_ID,
          worldId: world.id,
          name: pk.name,
          promptType: pk.promptType,
          version: 'v1',
          content: pk.content,
          status: 'active',
        })
        .returning();
      console.log(`  ✓ Created prompt_version ${pk.name}`);
    }
    // Bind to world default if not set
    const fresh = (await db.select().from(worlds).where(eq(worlds.id, world.id)))[0];
    if (!fresh[pk.versionField]) {
      await db
        .update(worlds)
        .set({ [pk.versionField]: row.id })
        .where(eq(worlds.id, world.id));
    }
  }

  // ---- 4. API providers ----
  const mockProvider = await findOrCreate(
    async () => {
      const [p] = await db
        .select()
        .from(apiProviders)
        .where(
          and(
            eq(apiProviders.ownerUserId, OWNER_USER_ID),
            eq(apiProviders.providerType, 'mock'),
          ),
        );
      return p;
    },
    async () => {
      const [p] = await db
        .insert(apiProviders)
        .values({
          ownerUserId: OWNER_USER_ID,
          providerType: 'mock',
          displayName: 'Mock Provider (offline canned outputs)',
          baseUrl: null,
          isOpenaiCompatible: false,
          status: 'active',
          metadata: {},
        })
        .returning();
      console.log('  ✓ Created mock provider');
      return p;
    },
  );

  await findOrCreate(
    async () => {
      const [p] = await db
        .select()
        .from(apiProviders)
        .where(
          and(
            eq(apiProviders.ownerUserId, OWNER_USER_ID),
            eq(apiProviders.providerType, 'openai'),
          ),
        );
      return p;
    },
    async () => {
      // Placeholder OpenAI provider - encrypts a fake key so the row exists
      const fakeKey = 'sk-PLACEHOLDER-replace-via-ui-' + Date.now();
      let encryptedMeta = {};
      try {
        encryptedMeta = { encrypted_api_key: encryptSecret(fakeKey) };
      } catch (e) {
        // ENCRYPTION_KEY missing - leave metadata empty so test connection fails gracefully
        console.warn(
          '  ⚠ ENCRYPTION_KEY missing or weak; openai provider has no key. Set it before using real openai.',
        );
        void e;
      }
      const [p] = await db
        .insert(apiProviders)
        .values({
          ownerUserId: OWNER_USER_ID,
          providerType: 'openai',
          displayName: 'OpenAI (placeholder - replace key in UI)',
          baseUrl: 'https://api.openai.com/v1',
          isOpenaiCompatible: true,
          status: 'active',
          metadata: encryptedMeta,
        })
        .returning();
      console.log('  ✓ Created openai provider (placeholder)');
      return p;
    },
  );

  // ---- 5. Embedding profile ----
  const embProfile = await findOrCreate(
    async () => {
      const [e] = await db
        .select()
        .from(embeddingProfiles)
        .where(
          and(
            eq(embeddingProfiles.worldId, world.id),
            eq(embeddingProfiles.name, 'demo-embedding'),
          ),
        );
      return e;
    },
    async () => {
      const [e] = await db
        .insert(embeddingProfiles)
        .values({
          ownerUserId: OWNER_USER_ID,
          worldId: world.id,
          providerId: null, // mock provider doesn't do embeddings; user can attach later
          name: 'demo-embedding',
          model: 'text-embedding-3-small',
          dimension: 1536,
          distanceMetric: 'cosine',
        })
        .returning();
      console.log('  ✓ Created embedding profile');
      return e;
    },
  );
  if (!world.defaultEmbeddingProfileId) {
    await db
      .update(worlds)
      .set({ defaultEmbeddingProfileId: embProfile.id })
      .where(eq(worlds.id, world.id));
  }

  // ---- 6. API profiles (all → mock) ----
  const profileSpecs = [
    { name: 'character_default', model: 'mock-character' },
    { name: 'world_agent_default', model: 'mock-world-agent' },
    { name: 'narrator_default', model: 'mock-narrator' },
  ];
  const profileMap = new Map<string, string>(); // name → id
  for (const ps of profileSpecs) {
    const existing = await db
      .select()
      .from(apiProfiles)
      .where(
        and(eq(apiProfiles.ownerUserId, OWNER_USER_ID), eq(apiProfiles.name, ps.name)),
      );
    let row = existing[0];
    if (!row) {
      [row] = await db
        .insert(apiProfiles)
        .values({
          ownerUserId: OWNER_USER_ID,
          providerId: mockProvider.id,
          name: ps.name,
          model: ps.model,
          temperature: '0.700',
          maxTokens: 2000,
          responseFormat: 'json',
          timeoutSeconds: 60,
          retryCount: 2,
          costLimitPerCall: '0.5000',
          costLimitPerRun: '2.0000',
          costLimitPerDay: '10.0000',
        })
        .returning();
      console.log(`  ✓ Created profile ${ps.name}`);
    }
    profileMap.set(ps.name, row.id);
  }

  // ---- 7. Entities (world_agent / narrator / 2 characters) ----
  const ensureEntity = async (
    name: string,
    entityType: 'character' | 'world_agent' | 'narrator',
    apiProfileName: string,
  ) => {
    const existing = await db
      .select()
      .from(entities)
      .where(
        and(
          eq(entities.worldId, world.id),
          eq(entities.name, name),
          eq(entities.entityType, entityType),
        ),
      );
    if (existing[0]) return existing[0];
    const [row] = await db
      .insert(entities)
      .values({
        worldId: world.id,
        entityType,
        name,
        status: 'active',
        apiProfileId: profileMap.get(apiProfileName),
      })
      .returning();
    console.log(`  ✓ Created entity ${entityType}: ${name}`);
    return row;
  };

  const worldAgent = await ensureEntity('主世界裁判', 'world_agent', 'world_agent_default');
  const narrator = await ensureEntity('小说整理器', 'narrator', 'narrator_default');
  const shenyuan = await ensureEntity('沈鸢', 'character', 'character_default');
  const linche = await ensureEntity('林澈', 'character', 'character_default');

  // ---- 8. Character profiles ----
  const ensureCharacter = async (
    entityId: string,
    profile: typeof characters.$inferInsert,
  ) => {
    const [existing] = await db
      .select()
      .from(characters)
      .where(eq(characters.entityId, entityId));
    if (existing) return existing;
    const [row] = await db.insert(characters).values(profile).returning();
    return row;
  };

  await ensureCharacter(shenyuan.id, {
    entityId: shenyuan.id,
    publicProfile: {
      name: '沈鸢',
      public_identity: '黑市情报商',
      appearance: '温柔克制，眼神警惕',
      known_reputation: '消息灵通但不可全信',
    },
    privateProfile: {
      personality: '谨慎、善于伪装、强烈求生欲',
      secrets: ['曾为黑塔工作', '昨晚去过钟楼'],
      trauma: ['害怕重新被黑塔控制'],
      moral_boundary: ['不主动伤害小孩'],
    },
    speechStyle: {
      sentence_length: '中短句',
      traits: ['喜欢反问', '不直接回答', '语气柔和'],
      forbidden_phrases: ['其实我', '我心里', '说真的'],
      sample_lines: ['你问错人了。', '王室封锁北区不是没有原因。', '别问得太多。'],
    },
    expressionProfile: {
      when_nervous: ['笑得更轻', '指尖动作变多', '反问更多'],
      when_lying: ['避开视线', '转移话题'],
    },
    desireProfile: {
      core_desire: '摆脱黑塔控制',
      fears: ['被旧主人找到', '林澈知道真相'],
      long_term_goal: '获得真正自由',
      short_term_goal: '确认林澈是否知道钟楼的事',
    },
    abilityProfile: {
      perception: 65,
      stealth: 55,
      social_insight: 80,
      combat: 25,
      mobility: 60,
    },
  });

  await ensureCharacter(linche.id, {
    entityId: linche.id,
    publicProfile: {
      name: '林澈',
      public_identity: '游侠，曾任王室侦缉',
      appearance: '冷峻，少话',
      known_reputation: '执着追查真相',
    },
    privateProfile: {
      personality: '直接，重视证据',
      secrets: ['哥哥死于钟楼事件'],
      trauma: ['哥哥的失踪'],
    },
    speechStyle: {
      sentence_length: '短句',
      traits: ['少解释，偏直接'],
      forbidden_phrases: ['可能吧', '随便'],
      sample_lines: ['你说完了？', '这不是答案。', '我只信证据。'],
    },
    expressionProfile: {
      when_angry: ['声音更轻', '眼神变冷'],
    },
    desireProfile: {
      core_desire: '查清哥哥死亡真相',
      fears: ['永远找不到答案'],
      short_term_goal: '从沈鸢嘴里挖出钟楼线索',
    },
    abilityProfile: {
      perception: 78,
      stealth: 40,
      social_insight: 55,
      combat: 75,
      mobility: 65,
    },
  });

  // ---- 9. Relationships (both directions) ----
  const ensureRel = async (src: string, tgt: string, dims: Partial<typeof relationships.$inferInsert>) => {
    const [exist] = await db
      .select()
      .from(relationships)
      .where(
        and(
          eq(relationships.worldlineId, worldline.id),
          eq(relationships.sourceEntityId, src),
          eq(relationships.targetEntityId, tgt),
        ),
      );
    if (exist) return exist;
    const [row] = await db
      .insert(relationships)
      .values({
        worldId: world.id,
        worldlineId: worldline.id,
        sourceEntityId: src,
        targetEntityId: tgt,
        ...dims,
      })
      .returning();
    return row;
  };

  await ensureRel(shenyuan.id, linche.id, {
    trust: '20',
    suspicion: '60',
    fear: '40',
    curiosity: '50',
    hostility: '15',
  });
  await ensureRel(linche.id, shenyuan.id, {
    trust: '15',
    suspicion: '70',
    curiosity: '65',
    hostility: '25',
  });

  // ---- 10. Initial memories ----
  const seedMemories: Array<{
    owner: string;
    type: string;
    content: string;
    visibility: string;
    importance: string;
    truth?: string;
    proposedBy?: string;
  }> = [
    {
      owner: shenyuan.id,
      type: 'core_profile',
      content: '我以情报商身份在地下酒馆活动，伪装得很好。',
      visibility: 'private',
      importance: '0.9',
    },
    {
      owner: shenyuan.id,
      type: 'secret',
      content: '昨晚我确实去过钟楼，并见过红衣信使。',
      visibility: 'private',
      importance: '0.95',
    },
    {
      owner: shenyuan.id,
      type: 'episodic',
      content: '林澈两天前曾在酒馆门口短暂停留，看了我两眼。',
      visibility: 'private',
      importance: '0.6',
    },
    {
      owner: shenyuan.id,
      type: 'plan',
      content: '今晚要把话题引向王室封锁北区的事，绕开钟楼。',
      visibility: 'private',
      importance: '0.75',
    },
    {
      owner: shenyuan.id,
      type: 'public_fact',
      content: '王室昨日宣布封锁北区，未说明原因。',
      visibility: 'public',
      importance: '0.5',
    },
    {
      owner: linche.id,
      type: 'core_profile',
      content: '我是查案的，靠证据说话。',
      visibility: 'private',
      importance: '0.9',
    },
    {
      owner: linche.id,
      type: 'episodic',
      content: '哥哥在钟楼附近失踪，尸首未找到。',
      visibility: 'private',
      importance: '0.95',
    },
    {
      owner: linche.id,
      type: 'inference',
      content: '沈鸢可能知道钟楼的事，但她伪装很深。',
      visibility: 'private',
      importance: '0.7',
      truth: 'inference',
    },
    {
      owner: linche.id,
      type: 'plan',
      content: '试探沈鸢对钟楼的反应。',
      visibility: 'private',
      importance: '0.8',
    },
    {
      owner: linche.id,
      type: 'public_fact',
      content: '王室昨日宣布封锁北区，未说明原因。',
      visibility: 'public',
      importance: '0.5',
    },
  ];

  for (const m of seedMemories) {
    const exist = await db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.worldlineId, worldline.id),
          eq(memories.ownerEntityId, m.owner),
          eq(memories.content, m.content),
        ),
      );
    if (exist[0]) continue;
    await db.insert(memories).values({
      worldId: world.id,
      worldlineId: worldline.id,
      ownerEntityId: m.owner,
      memoryType: m.type,
      content: m.content,
      visibility: m.visibility,
      importance: m.importance,
      truthStatus: m.truth ?? 'subjective',
      proposedBy: m.proposedBy ?? 'character_self',
      approvalStatus: 'auto_approved',
    });
  }
  console.log(`  ✓ Seeded ${seedMemories.length} memories`);

  // ---- 11. Pending scene ----
  const sceneTitle = '地下酒馆 · 第一夜';
  const [existingScene] = await db
    .select()
    .from(scenes)
    .where(and(eq(scenes.worldlineId, worldline.id), eq(scenes.title, sceneTitle)));
  if (!existingScene) {
    await db.insert(scenes).values({
      worldId: world.id,
      worldlineId: worldline.id,
      title: sceneTitle,
      worldTime: { world_day: 5, time_block: 'night', scene_clock_minutes: 0 },
      participantEntityIds: [shenyuan.id, linche.id],
      status: 'pending',
    });
    console.log('  ✓ Created pending scene');
  }

  console.log('✓ Seed complete.');
  console.log('');
  console.log('Next steps:');
  console.log(`  1. Open the UI and select world: 雾城试验场 (${world.id})`);
  console.log('  2. Go to /simulation, pick the pending scene, click "运行下一轮"');
  console.log('  3. Mock provider will return canned valid JSON; round should commit');

  // Suppress unused
  void worldAgent;
  void narrator;
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  });
