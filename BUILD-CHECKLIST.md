# 写小说 Pro — 完整补完任务清单

> 基于 `xiexiaoshuopro-main` 当前快照（6,519 行）补完到 SYSTEM-DESIGN.md 要求的完整形态。
> 目标体量：~50,000 行 TypeScript + ~25,000 行 prompt markdown + ~8,000 行测试。
> 总任务数：**285 项**，分 12 部分。

---

## 0. 怎么读这份清单

### 0.1 任务编号

`T-X.Y` 格式。X 是部分号，Y 是任务序号。一个任务对应一个**可独立 vibe code 的工作单元**。

### 0.2 状态标记

| 标记 | 含义 |
|---|---|
| ✗ | 完全缺失 |
| ⚠️ | 存在但有 bug，需要重写或大改 |
| ⚪ | 占位实现，需要深化 |
| ✓ | 完成（如有，意思是当前已可用，不需要动） |

### 0.3 操作类型

- **NEW**：新增文件
- **REWRITE**：现有文件整个重写
- **PATCH**：现有文件局部修改
- **EXTEND**：现有文件功能扩展
- **DELETE**：删除（死代码）

### 0.4 依赖关系

每条任务标注 `Deps:` 列出依赖任务。**不要跳依赖**——会反复返工。

### 0.5 给 vibe coding 的姿势

每条任务的颗粒度都设计成"一次 AI 对话能完成"。建议姿势：

```
"参照 BUILD-CHECKLIST.md 的 T-X.Y，结合 SYSTEM-DESIGN.md §X，
 写出 path/to/file.ts。要求：[关键接口签名]。
 当前状态：[本任务状态]。"
```

---

## Part 1: P0 紧急修复（不修无法启动）

### 模块：基础设施层

---

#### T-1.1 修复 LLM 模型 ID 与 baseURL 不匹配

**状态**：⚠️ 致命 bug
**操作**：REWRITE
**文件**：`src/lib/models.ts`
**Deps**：无（最先做）

**问题**：当前 baseURL 是 `https://api.deepseek.com`，但 model id 是 `'minimaxai/minimax-m2.5'`，调用直接 404。

**目标接口**：

```ts
// src/lib/models.ts
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

export type Provider = 'deepseek' | 'qwen' | 'qwen-self-hosted' | 'openrouter' | 'nvidia-nim'
export type ModelTask =
  | 'draft' | 'outline' | 'review' | 'summary' | 'simulation'
  | 'rewrite' | 'extract' | 'character' | 'director' | 'narrator'
  | 'reasoner' | 'embed-fallback' | 'safety-router'

export interface ModelConfig {
  model: LanguageModel
  provider: Provider
  modelId: string
  temperature: number
  maxTokens: number
}

// 工厂
export function deepseekChat(): LanguageModel
export function deepseekReasoner(): LanguageModel
export function qwenMax(): LanguageModel
export function qwenSelfHosted(modelName?: string): LanguageModel
export function nvidiaModel(modelId: string): LanguageModel  // 走 NIM
export function openrouterModel(modelId: string): LanguageModel

// 路由
export function getModelForTask(
  task: ModelTask,
  opts?: { safetyLevel?: 'strict' | 'normal' | 'unrestricted'; preferProvider?: Provider }
): ModelConfig
```

**关键约束**：
- `deepseekChat()` 必须返回 `deepseek-chat` 这个 model id
- baseURL 与 modelId 必须配对
- safetyLevel='unrestricted' 时优先走 self-hosted-qwen 或 NIM
- 所有 modelId 用枚举常量集中管理（不再字符串散布）

**验收**：写一个 `tests/lib/models.test.ts`，断言 `deepseekChat().modelId === 'deepseek-chat'`，并且能真的发出请求拿到响应（用真实 API key 跑 integration 测试）。

---

#### T-1.2 删除测试中锁死 bug 的断言

**状态**：⚠️
**操作**：PATCH
**文件**：`tests/lib/models.test.ts`、`tests/api/llm-integration.test.ts`、`tests/workflows/simulation.test.ts`、`tests/workflows/chapter-generation.test.ts`
**Deps**：T-1.1

**问题**：测试文件里 `expect(model.modelId).toBe('minimaxai/minimax-m2.5')` 把 bug 锁成"正确答案"。`tests/api/llm-integration.test.ts:5-6` 把 NIM endpoint 当成默认值。`tests/workflows/*.test.ts` 通过 `fetch('https://integrate.api.nvidia.com/v1/...')` 测连通性，但生产代码走 DeepSeek。

**目标**：所有测试统一使用 `process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'` + `'deepseek-chat'`。

**验收**：`npm run test` 全绿且不再硬编码 minimax 字符串。

---

#### T-1.3 修复 Prompt 渲染管线

**状态**：⚠️ 严重 bug
**操作**：REWRITE
**文件**：`src/lib/prompts.ts`
**Deps**：无

**问题**：当前 `readPromptSync` 返回带 frontmatter 的原始内容，`renderPrompt` 全项目零调用。结果：所有 agent 的 instructions 是带 `{{ chapter_outline }}` 占位符的原始 markdown，外加 yaml frontmatter 头一并喂给 LLM。

**目标接口**：

```ts
// src/lib/prompts.ts
export interface PromptMeta {
  name: string
  version: number
  description?: string
  modelPreference?: string
  temperature?: number
  maxTokens?: number
  requiredVars?: string[]
  optionalVars?: string[]
  outputFormat?: 'markdown' | 'json' | 'xml' | 'plain'
  streaming?: boolean
  [key: string]: unknown
}

export interface LoadedPrompt {
  meta: PromptMeta
  body: string
  rendered: string  // 已替换占位符
  unfilled: string[]  // required 中没填的占位符（应为空）
}

/** 读 + 解 frontmatter + 渲染变量 一站式 */
export function loadPrompt(
  relativePath: string,
  vars: Record<string, string | number | undefined>
): LoadedPrompt

/** 仅在测试 / 调试时使用 */
export function parseFrontmatter(content: string): { meta: PromptMeta; body: string }
export function renderTemplate(template: string, vars: Record<string, unknown>): string
```

**关键实现要点**：
- frontmatter 解析必须支持 yaml 数组（`required_vars: [a, b, c]` 或多行 `- x`）
- `renderTemplate` 支持 `{{ var }}`、`{{#if var}}...{{/if}}`、`{{#each items}}...{{/each}}` 三种最小模板能力
- `loadPrompt` 必须验证 required_vars 是否都填了，未填的写到 `unfilled`，调用方决定 throw 还是 warn
- 渲染后必须 `body.trim()`，避免 frontmatter 后的空行
- 启用文件级缓存（同一文件读一次解一次）

**验收**：单元测试覆盖：frontmatter 解析、变量替换、缺变量警告、循环模板、嵌套引用。

---

#### T-1.4 移除所有 agent 中的 hardcoded fallback prompt

**状态**：⚠️ 设计违背
**操作**：PATCH
**文件**：所有 `src/mastra/agents/*.ts`
**Deps**：T-1.3

**问题**：当前所有 agent 都是这样写的：

```ts
const instructions = readPromptSync('agents/chapter-draft.md') || `你是一位专业的小说执笔者...`
```

这违反"prompt 是核心 IP"——hardcoded fallback 会在 prompt 文件丢失时静默用旧的 prompt。

**目标**：

```ts
// 改成动态构造，每次调用时 loadPrompt
import { loadPrompt } from '@/lib/prompts'

export function createChapterDraftAgent(vars: ChapterDraftVars) {
  const prompt = loadPrompt('agents/chapter-draft.md', vars)
  if (prompt.unfilled.length > 0) {
    throw new Error(`Missing required vars: ${prompt.unfilled.join(', ')}`)
  }
  return new Agent({
    id: 'chapter-draft',
    name: 'chapter-draft',
    instructions: prompt.rendered,
    model: deepseekChat(),
  })
}
```

注意：**Mastra Agent 的 instructions 在创建后不能改**，所以这些 agent 必须**每次调用时新建实例**（或用 `getInstructions(runtimeContext)` 函数版）。下面 T-3.x 会给统一封装。

---

#### T-1.5 启动 Mastra runtime 真正的注入

**状态**：⚠️ 装了没用
**操作**：REWRITE
**文件**：`src/mastra/index.ts`
**Deps**：T-1.4、T-3.1（pg 存储）

**问题**：当前注册了 8 个 agent 但项目零调用 `mastra.getAgent(...)`。

**目标接口**：

```ts
// src/mastra/index.ts
import { Mastra } from '@mastra/core'
import { PostgresStore, PgVector } from '@mastra/pg'
import { allAgents } from './agents'
import { allWorkflows } from './workflows'
import { logger } from '@/lib/observability/logger'

export const mastra = new Mastra({
  agents: allAgents,
  workflows: allWorkflows,
  storage: new PostgresStore({ connectionString: process.env.DATABASE_URL! }),
  vectors: { pg: new PgVector({ connectionString: process.env.DATABASE_URL! }) },
  logger,
  telemetry: { enabled: true, serviceName: 'xiexiaoshuopro' },
})

// agent 工厂 helper：所有 agent 通过这里取得，确保 vars 注入
export async function getAgentInstance(name: string, vars: Record<string, unknown>)
```

**关键约束**：
- 不再 import 单独的 agent 实例，统一从 `allAgents` 集合访问
- workflows 也注册进来，让 Mastra 接管生命周期 + observability
- storage 用 PostgresStore，vector 用 PgVector（依赖 T-3.x）

---

#### T-1.6 删除死代码（暂时）

**状态**：⚠️
**操作**：DELETE
**文件**：以下文件如果在 P0/P1 不会立刻接通，先注释掉/删除以保持代码库干净
**Deps**：无

| 文件 | 暂时删除原因 |
|---|---|
| `src/mastra/agents/director.ts` | P3 才接通 |
| `src/mastra/agents/narrator.ts` | P3 |
| `src/mastra/agents/character-agent.ts` | P3 |
| `src/mastra/agents/reviewers/index.ts` | P2 才接通，且会被拆分 |

**做法**：移到 `src/mastra/_unused/` 目录，等到对应任务时再激活。Git diff 不会乱，且让"未使用"显式可见。

---

## Part 2: 数据库补全

### 模块：所有

---

#### T-2.1 启用 pgvector 扩展

**状态**：⚠️ 未启用
**操作**：NEW migration
**文件**：`drizzle/0000_init_extensions.sql`
**Deps**：无

**目标**：

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- 用于文本相似度
CREATE EXTENSION IF NOT EXISTS uuid-ossp;
```

---

#### T-2.2 修复 embedding 字段类型

**状态**：⚠️ 类型错（jsonb 当 vector）
**操作**：REWRITE
**文件**：`src/db/schema.ts` 中所有带 `embedding` 字段的表
**Deps**：T-2.1

**目标**：

```ts
import { vector } from 'drizzle-orm/pg-core'

// 替换所有 jsonb('embedding') →
embedding: vector('embedding', { dimensions: 1024 })
```

涉及表：`worldEntries`、`characters`、`chapterChunks`（新增）、`scriptCharacterChunks`（新增）、`characterEpisodicMemory`。

每个表加 ivfflat 索引：

```sql
CREATE INDEX ON world_entries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

#### T-2.3-2.16 补齐缺失的 14 张表

**状态**：✗
**操作**：EXTEND
**文件**：`src/db/schema.ts`
**Deps**：T-2.1、T-2.2

每张表给完整 drizzle 定义。下面只给签名，具体字段参见 SYSTEM-DESIGN.md §4。

| ID | 表名 | 设计文档参考 |
|---|---|---|
| T-2.3 | `factions` | §4.2 |
| T-2.4 | `factionRelations` | §4.2 |
| T-2.5 | `timelineEvents` | §4.2 |
| T-2.6 | `characterAppearances` | §4.3 |
| T-2.7 | `characterVoiceAnchors` | §4.3 |
| T-2.8 | `slopBlacklist` | §4.8 |
| T-2.9 | `styleDriftAlerts` | §4.8 |
| T-2.10 | `reviewRuns` | §4.7 |
| T-2.11 | `fixAttempts` | §4.7 |
| T-2.12 | `agentDecisions` | §4.12 |
| T-2.13 | `toolCalls` | §4.12 |
| T-2.14 | `promptExperiments` | §4.14 |
| T-2.15 | `chapterChunks` | §4.5 |
| T-2.16 | `scriptCharacterChunks` | §4.6 |

**验收**：`drizzle-kit push` 成功，pg 中 45 张表 + 12 个 enum 全部存在。

---

#### T-2.17 拆分 schema 文件

**状态**：⚠️ 单文件 478 行已偏大，补完后会到 1500+ 行
**操作**：REWRITE
**文件**：拆 `src/db/schema.ts` 为 `src/db/schema/{module}.ts`
**Deps**：T-2.3 到 T-2.16

**目标结构**：

```
src/db/schema/
├── index.ts              # 全部 re-export
├── enums.ts              # 所有 pgEnum
├── project.ts
├── outline.ts            # volumes, chapter_outlines, scene_markers
├── generation.ts         # chapters, chapter_versions, chapter_summaries, chapter_chunks
├── world.ts              # canon_facts, world_entries, factions, faction_relations, timeline_events
├── character.ts          # characters, knowledge, relationships, appearances, voice_anchors, episodic_memory
├── simulation.ts         # simulations, turns, scripts, character_states, script_character_chunks
├── review.ts             # issues, review_runs, fix_attempts
├── style.ts              # voice_cards, slop_blacklist, style_fingerprints, style_drift_alerts
├── time.ts               # world_clock, between_chapter_events, faction_movements
├── version.ts            # version_dependencies, version_branches
├── observability.ts      # jobs, llm_calls, tool_calls, agent_decisions
├── prompt.ts             # prompts, prompt_runs, prompt_experiments
└── export.ts             # exports
```

---

#### T-2.18 数据库 query helpers

**状态**：✗
**操作**：NEW
**文件**：`src/db/queries/{module}.ts`（按模块）
**Deps**：T-2.17

每个模块的常用查询封装，避免在 API 路由里写散乱的 drizzle 调用。例如：

```ts
// src/db/queries/chapter.ts
export async function getChapterWithActiveVersion(chapterId: string)
export async function getChapterContext(chapterId: string): Promise<ChapterContext>
//   返回章节上下文：outline + prev_summary + characters + bible_extract + voice_card
export async function appendChapterVersion(chapterId: string, content: string, source: string)
export async function setChapterStatus(chapterId: string, status: string)
```

预计 14 个 query 模块文件，每个 100-300 行。

---

#### T-2.19 数据库种子脚本

**状态**：✗
**操作**：NEW
**文件**：`src/db/seed/index.ts`
**Deps**：T-2.17

**目标**：

```ts
async function seed() {
  await seedSlopBlacklist()      // 从 prompts/slop_dictionaries/ 同步到 DB
  await seedGenreDefaults()       // 默认 genre 配置
  await seedPromptsFromDisk()     // prompts/agents/ 内容同步到 prompts 表
}
```

`npm run db:seed` 跑这个。后续每次启动都执行 `seedPromptsFromDisk`（diff-based 同步）。

---

#### T-2.20 数据库迁移管理

**状态**：✗
**操作**：NEW
**文件**：`drizzle.config.ts` + `package.json` scripts
**Deps**：T-2.17

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:push": "drizzle-kit push",       // 仅本地开发
"db:seed": "tsx src/db/seed/index.ts",
"db:studio": "drizzle-kit studio"
```

生产用 generate + migrate，不用 push。

---

## Part 3: 基础设施层（lib）

### 模块：横切

---

#### T-3.1 LLM 路由器（按任务 + 安全级别 + 重试 + 缓存）

**状态**：⚠️ 现有 models.ts 仅提供模型工厂，缺路由策略
**操作**：NEW
**文件**：`src/lib/llm/router.ts`
**Deps**：T-1.1

**目标接口**：

```ts
export interface LLMCallOptions {
  task: ModelTask
  safetyLevel?: SafetyLevel
  preferProvider?: Provider
  retryStrategy?: 'aggressive' | 'normal' | 'none'
  cacheKey?: string  // 用于 prompt caching
  abortSignal?: AbortSignal
  jobId?: string  // 用于 observability
}

export async function llmGenerate(prompt: string | CoreMessage[], opts: LLMCallOptions): Promise<{
  text: string
  reasoning?: string
  tokensIn: number
  tokensOut: number
  costUsd: number
  finishReason: string
  durationMs: number
  provider: Provider
  modelId: string
}>

export async function llmStream(prompt: string | CoreMessage[], opts: LLMCallOptions): Promise<{
  textStream: AsyncIterable<string>
  reasoningStream?: AsyncIterable<string>
  done: Promise<{ ... }>
}>
```

**关键能力**：

- **重试策略**：aggressive = 5 次（rate limit / 5xx 都重试），normal = 2 次，none = 0
- **fallback 链**：DeepSeek 失败自动走 Qwen，Qwen 失败走 self-hosted-qwen，最后 OpenRouter
- **cost 计算**：内置当前各 provider 价格表，自动算 USD
- **observability**：自动写入 `llm_calls` 表（每次调用一条），如 jobId 提供则关联
- **content_filter 处理**：finish_reason='content_filter' 时切换到 unrestricted 链

---

#### T-3.2 Embedding 服务封装

**状态**：✗
**操作**：NEW
**文件**：`src/lib/embed.ts`
**Deps**：T-2.2

**目标接口**：

```ts
export async function embed(text: string): Promise<number[]>  // 1024 维
export async function embedBatch(texts: string[]): Promise<number[][]>

// 切块 + 嵌入 + 写入指定表
export async function embedAndStore<T>(opts: {
  texts: string[]
  table: 'chapter_chunks' | 'world_entries' | 'character_episodic_memory' | 'script_character_chunks'
  metadata: Partial<T>[]
}): Promise<void>
```

**关键约束**：
- 优先走 BGE_M3_URL（本地）
- 不可用时 fallback 到 Qwen text-embedding API
- 批量调用：每批最大 32 条
- 缓存：相同文本的 embedding 24 小时缓存（用 hash）

---

#### T-3.3 RAG 检索器

**状态**：✗
**操作**：NEW
**文件**：`src/lib/rag.ts`
**Deps**：T-3.2、T-2.2

**目标接口**：

```ts
export interface RagSearchOptions {
  projectId: string
  query: string
  topK?: number
  filter?: Record<string, unknown>  // 比如 { kind: 'location' }
  minScore?: number
}

export async function searchBibleEntries(opts: RagSearchOptions): Promise<WorldEntry[]>
export async function searchChapterChunks(opts: RagSearchOptions): Promise<ChapterChunk[]>
export async function searchCharacterMemory(opts: RagSearchOptions & { characterId: string }): Promise<EpisodicMemory[]>
export async function searchPreviousScripts(opts: RagSearchOptions & { characterIds: string[] }): Promise<ScriptChunk[]>

// hybrid: 向量 + 关键词
export async function hybridSearch(opts: RagSearchOptions & { keywords?: string[] }): Promise<...>
```

**关键约束**：
- 用 pgvector 的 `<=>` (cosine distance) 操作符
- 必须按 projectId 隔离
- 返回结果必须包含 score
- 支持 metadata filter（jsonb 字段查询）

---

#### T-3.4 Slop 检测增强

**状态**：⚪ 现有简单实现
**操作**：EXTEND
**文件**：`src/lib/slop-detector.ts`
**Deps**：T-2.8

**当前能力**：从 `prompts/slop_dictionaries/chinese_general.json` 加载 20 项黑名单，做字符串匹配。

**扩展为**：

```ts
export interface SlopHit {
  pattern: string
  category: 'cliche' | 'ai_tell' | 'over_explain' | 'empty_emotion' | 'repetition' | 'sentence_pattern'
  position: number
  matched: string
  suggestion?: string
}

export async function detectSlop(text: string, projectId?: string): Promise<{
  hits: SlopHit[]
  rate: number  // hits per 1000 chars
  byCategory: Record<string, number>
}>

export async function getActiveBlacklist(projectId: string): Promise<SlopPattern[]>
// 从 DB 拉项目级 + 全局，DB 优先

export async function suggestReplacement(hit: SlopHit, context: string): Promise<string>
// 调 LLM 给替换建议
```

**关键扩展**：
- 黑名单从 DB 加载（`slop_blacklist` 表），文件作为初始种子
- 支持正则 pattern
- 检测句式重复（连续 3 句以"她……"开头）
- 检测词频集中（同一词 N 字内出现 ≥ 3 次）

---

#### T-3.5 Style fingerprint 增强

**状态**：⚪
**操作**：EXTEND
**文件**：`src/lib/style-fingerprint.ts`
**Deps**：无

**目标接口**：

```ts
export interface StyleFingerprint {
  avgSentenceLength: number
  sentenceLengthVariance: number
  vocabRichness: number       // type-token ratio
  metaphorDensity: number     // 比喻密度（启发式）
  dialogueRatio: number       // 对话占比
  paragraphDensity: number    // 平均每段字数
  pacingRhythm: number[]      // 每 1000 字的句子数序列
  repeatedPhrases: { phrase: string; count: number }[]
  tagCloudTop20: { word: string; freq: number }[]
}

export function computeStyleFingerprint(text: string): StyleFingerprint
export function compareFingerprints(a: StyleFingerprint, b: StyleFingerprint): {
  driftAxis: string
  severity: 'minor' | 'moderate' | 'severe'
  details: string
}[]
export async function detectDrift(chapterId: string): Promise<StyleDriftAlert[]>
```

---

#### T-3.6 Cost tracker

**状态**：✗
**操作**：NEW
**文件**：`src/lib/cost.ts`
**Deps**：T-2.13

**目标接口**：

```ts
export const PRICING: Record<Provider, Record<string, { in: number; out: number; cachedIn?: number }>> = {
  deepseek: {
    'deepseek-chat': { in: 0.27, out: 1.10, cachedIn: 0.07 },
    'deepseek-reasoner': { in: 0.55, out: 2.19, cachedIn: 0.14 },
  },
  qwen: { 'qwen-max': { ... } },
  // ...
}

export function calcCost(provider: Provider, modelId: string, tokensIn: number, tokensOut: number, cached?: boolean): number

export async function getMonthlyUsage(projectId?: string): Promise<{
  totalUsd: number
  byProvider: Record<Provider, number>
  byTask: Record<ModelTask, number>
  byAgent: Record<string, number>
}>

export async function checkBudget(projectId?: string): Promise<{
  used: number
  budget: number
  remaining: number
  alertLevel: 'ok' | 'warning' | 'critical'
}>
```

---

#### T-3.7 Observability logger

**状态**：✗
**操作**：NEW
**文件**：`src/lib/observability/{logger.ts,trace.ts,replay.ts}`
**Deps**：T-2.10、T-2.12、T-2.13

**目标**：

```ts
// logger.ts
export const logger: MastraLogger  // 实现 Mastra logger interface

// trace.ts
export interface TraceContext {
  jobId: string
  parentJobId?: string
  agentName?: string
  promptId?: string
}

export async function startJob(opts: { type: string; projectId?: string; input: unknown; parentJobId?: string }): Promise<string>
export async function completeJob(jobId: string, output: unknown): Promise<void>
export async function failJob(jobId: string, error: Error): Promise<void>
export async function logLlmCall(ctx: TraceContext, call: LLMCallRecord): Promise<void>
export async function logToolCall(ctx: TraceContext, call: ToolCallRecord): Promise<void>
export async function logAgentDecision(ctx: TraceContext, decision: AgentDecisionRecord): Promise<void>

// replay.ts
export async function replayJob(jobId: string): Promise<ReplayResult>
//   从 llm_calls + tool_calls + agent_decisions 重建完整执行轨迹
```

---

#### T-3.8 Content safety router

**状态**：✗
**操作**：NEW
**文件**：`src/lib/safety.ts`
**Deps**：T-3.1

**目标接口**：

```ts
export interface SafetyAssessment {
  level: 'safe' | 'mild' | 'moderate' | 'extreme'
  flags: string[]  // 'violence', 'sexual', 'extremism', ...
  recommendedProvider: Provider
}

// 用一个轻量 LLM 调用预判内容
export async function assessContentSafety(text: string): Promise<SafetyAssessment>

// 根据 chapter outline / scene goal 提前路由 provider
export async function routeProviderByContent(
  contentHint: string,
  task: ModelTask
): Promise<Provider>
```

---

#### T-3.9 Streaming utilities

**状态**：✗
**操作**：NEW
**文件**：`src/lib/streaming/{sse.ts,events.ts,abort.ts}`
**Deps**：无

**目标**：

```ts
// sse.ts
export interface SSEEvent<T = unknown> {
  type: string
  data: T
  jobId?: string
  timestamp: number
}

export function createSSEStream<T>(generator: AsyncIterable<SSEEvent<T>>): Response
export function parseSSE(response: Response): AsyncIterable<SSEEvent>

// events.ts - 各类 event payload 类型定义
export type ChapterStreamEvent =
  | { type: 'token'; data: string }
  | { type: 'tool_call'; data: { tool: string; input: unknown } }
  | { type: 'tool_result'; data: { tool: string; output: unknown } }
  | { type: 'meta'; data: { agentName: string; promptId: string } }
  | { type: 'done'; data: { totalTokens: number; cost: number } }
  | { type: 'error'; data: { message: string } }

export type SimulationStreamEvent =
  | { type: 'turn_start'; data: { speakerId: string; speakerName: string; turnIdx: number } }
  | { type: 'token'; data: { delta: string; channel: 'utterance' | 'reasoning' } }
  | { type: 'turn_end'; data: { turnId: string; visibleTo: string[] } }
  | { type: 'director_decision'; data: { action: string; reasoning: string } }
  | { type: 'inject'; data: { eventText: string } }
  | { type: 'paused' | 'resumed' | 'cancelled' | 'done' | 'error'; data: unknown }

// abort.ts - 中断管理
export class AbortRegistry {
  register(jobId: string, controller: AbortController): void
  abort(jobId: string): void
  cleanup(jobId: string): void
}
export const abortRegistry: AbortRegistry
```

---

#### T-3.10 Memory store（自定义 store for Mastra）

**状态**：✗
**操作**：NEW
**文件**：`src/lib/memory/{character-memory.ts,episodic-store.ts,working-memory-templates.ts}`
**Deps**：T-2.17、T-3.2

**目标**：

```ts
// character-memory.ts - 配置每个角色 agent 的 Memory 实例
export function createCharacterMemory(characterId: string, projectId: string): Memory

// episodic-store.ts - 自定义 episodic memory store
export class EpisodicMemoryStore {
  async add(characterId: string, episode: EpisodicMemory): Promise<void>
  async search(characterId: string, query: string, topK: number): Promise<EpisodicMemory[]>
  async getRecent(characterId: string, n: number): Promise<EpisodicMemory[]>
  async compress(characterId: string): Promise<void>  // 合并低 importance episode
}
export const episodicStore: EpisodicMemoryStore

// working-memory-templates.ts - working memory 模板
export const characterWorkingMemoryTemplate: string
export const directorWorkingMemoryTemplate: string
export const readerSimulatorWorkingMemoryTemplate: string
```

---

#### T-3.11 Genre profile loader

**状态**：⚪ 文件已有但无 loader
**操作**：NEW
**文件**：`src/lib/genre.ts`
**Deps**：无

```ts
export interface GenreProfile {
  name: string
  contract: string             // 类型契约
  openingTemplates: string[]
  chapterStructure: string
  voicePositive: string[]
  voiceNegative: string[]
  dialogueRatio: number        // 对话/描写比例参考
  characterEmphasis: string[]
  pacingPreferences: { actionPace: number; reflectionPace: number }
  endingHookStrength: number
}

export function loadGenreProfile(genre: string): GenreProfile
export function blendGenreProfiles(genres: string[]): GenreProfile  // 类型混合
```

补全 `prompts/genre_profiles/{universal,horror}.json`。

---

#### T-3.12 Voice card system

**状态**：⚪
**操作**：NEW
**文件**：`src/lib/voice/{loader.ts,renderer.ts,extractor.ts}`
**Deps**：T-2.18

```ts
// loader.ts
export async function getProjectVoiceCard(projectId: string): Promise<VoiceCard>
export async function getCharacterVoiceCard(characterId: string): Promise<VoiceCard>
export async function getActiveVoiceCard(scope: 'project' | 'character' | 'narrator', scopeId: string): Promise<VoiceCard>

// renderer.ts - 把 voice card 渲染成 prompt 注入文本
export function renderVoiceForPrompt(card: VoiceCard, opts?: { compact?: boolean }): string

// extractor.ts - 从样本提炼 voice card
export async function extractVoiceFromSamples(samples: string[]): Promise<Omit<VoiceCard, 'id' | 'projectId'>>
```

---

#### T-3.13 Diff utility

**状态**：✗
**操作**：NEW
**文件**：`src/lib/diff.ts`
**Deps**：无

```ts
export function diffMarkdown(a: string, b: string): { unified: string; html: string; stats: { added: number; removed: number } }
export function applyPatch(original: string, patch: string): string
export function chapterDiff(versionA: string, versionB: string): ChapterDiff  // 段落级 diff
```

用 `diff-match-patch` 包。

---

#### T-3.14 Zod schemas（外部输入验证）

**状态**：✗ 部分（路由各自验证）
**操作**：NEW
**文件**：`src/lib/schemas/{project,character,outline,chapter,simulation,issue}.ts`
**Deps**：无

每个模块的输入 / 输出 Zod schema 集中定义，API 路由和 Mastra tool 共用。

---

## Part 4: Prompt 库

### 模块：所有

预计补完后 70+ 文件，~25,000 行 markdown。当前 8 个文件 327 行。

---

#### T-4.1 共享 prompt 片段

**状态**：✗
**操作**：NEW
**文件**：

```
prompts/_shared/
├── voice_injection.md          # 通用声音注入框架
├── safety_framing.md           # 内容尺度提示框架
├── output_format_xml.md        # XML 输出约束
├── output_format_json.md       # JSON 输出约束
├── pov_definitions.md          # POV 类型说明
├── tone_guidance.md            # 语气调用模板
└── anti_slop_principles.md     # 反 AI 味原则
```

每个 100-300 行，被其他 prompt 通过 `{{> _shared/voice_injection}}` 引用（要扩展 renderTemplate 支持 partial）。

---

#### T-4.2-4.10 Generation 类 prompt（深化）

**状态**：⚪ 当前 2 个有 + 7 个缺
**操作**：REWRITE / NEW

| ID | 文件 | 状态 | 目标行数 |
|---|---|---|---|
| T-4.2 | `prompts/agents/premise.md` | ⚪ 重写 | 250+ |
| T-4.3 | `prompts/agents/volume_outline.md` | ✗ 新增 | 300+ |
| T-4.4 | `prompts/agents/chapter_outline.md` | ✗ 新增 | 350+ |
| T-4.5 | `prompts/agents/chapter_draft.md` | ⚪ 重写 | 500+ |
| T-4.6 | `prompts/agents/chapter_summary.md` | ✗ 新增 | 200+ |
| T-4.7 | `prompts/agents/hook.md` | ✗ 新增 | 150+ |
| T-4.8 | `prompts/agents/section_rewriter.md` | ✗ 新增 | 250+ |
| T-4.9 | `prompts/agents/scenify.md` | ✗ 新增 | 400+ |
| T-4.10 | `prompts/agents/bible_extract.md` | ✗ 新增 | 250+ |

**chapter_draft.md 关键内容必须包含**：
- 角色定位与本作类型说明
- voice card 注入位置
- 类型契约（从 genre profile 注入）
- 涉及人物的私密档案（含 secret_motive，但要求"不得直接复述"）
- bible 摘录注入位置
- 章节间事件三类（hidden / hinted / revealed）的写作指导
- POV 与人称约束
- arc beat 推进要求
- 章末钩子强度要求
- 反 slop 黑名单 top 20 注入位置
- 输出格式约束
- 字数目标 ± 容忍

---

#### T-4.11-4.20 Character 类 prompt

| ID | 文件 | 行数 |
|---|---|---|
| T-4.11 | `prompts/agents/character_profile_principal.md` | 300+ |
| T-4.12 | `prompts/agents/character_profile_recurring.md` | 200+ |
| T-4.13 | `prompts/agents/walkon_inline.md` | 100+ |
| T-4.14 | `prompts/agents/voice_extract.md` | 250+ |
| T-4.15 | `prompts/agents/knowledge_diff.md` | 350+ |
| T-4.16 | `prompts/agents/relationship_update.md` | 250+ |
| T-4.17 | `prompts/agents/character_promotion_evaluator.md` | 200+ |
| T-4.18 | `prompts/agents/character_arc_progress.md` | 250+ |
| T-4.19 | `prompts/agents/voice_drift_detector.md` | 200+ |
| T-4.20 | `prompts/agents/relationship_init.md` | 200+ |

---

#### T-4.21-4.25 Simulation 类 prompt

| ID | 文件 | 行数 | 关键 |
|---|---|---|---|
| T-4.21 | `prompts/agents/director.md` | 400+ | 决策框架：speak/inject/end |
| T-4.22 | `prompts/agents/character_agent_template.md` | 600+ | **角色 agent 通用模板**，包含知识隔离指令 |
| T-4.23 | `prompts/agents/narrator.md` | 500+ | 剧本 → 小说叙述化 |
| T-4.24 | `prompts/agents/cost_estimator.md` | 150+ | 推演前预估 |
| T-4.25 | `prompts/agents/scene_recap.md` | 200+ | 推演完小结 |

**T-4.22 是最复杂的一个**，必须包含：
- 角色身份注入（公开 + 私密）
- 当前知识状态（facts / suspected / lies）
- 当前情绪与目标
- voice card 注入
- 看到的"其他角色公开行为"列表（不含 reasoning）
- 行为规则：仅基于自己知识、不得 metagaming
- 输出 JSON 格式（utterance / reasoning / emotional_shift / target_action_on）
- 反 OOC 规则
- 反"剧情服务"规则（角色不为剧情走向妥协）

---

#### T-4.26-4.36 Reviewer 类 prompt（11 个）

每个 reviewer 一个独立 prompt 文件，250-400 行。

| ID | 文件 | 检查重点 |
|---|---|---|
| T-4.26 | `prompts/agents/reviewer/logic.md` | 因果链、bug |
| T-4.27 | `prompts/agents/reviewer/voice.md` | 角色声音一致性 |
| T-4.28 | `prompts/agents/reviewer/canon.md` | 与 canon 矛盾 |
| T-4.29 | `prompts/agents/reviewer/pacing.md` | 节奏分析 |
| T-4.30 | `prompts/agents/reviewer/theme.md` | 卷命题贡献度 |
| T-4.31 | `prompts/agents/reviewer/genre.md` | 类型契约 |
| T-4.32 | `prompts/agents/reviewer/reader.md` | 读者体验模拟 |
| T-4.33 | `prompts/agents/reviewer/slop.md` | AI 味整体评估 |
| T-4.34 | `prompts/agents/reviewer/volume.md` | 卷级综合 |
| T-4.35 | `prompts/agents/reviewer/continuity.md` | 跨章连续性 |
| T-4.36 | `prompts/agents/reviewer/relationship.md` | 关系演化合理性 |

每个 reviewer prompt 必须输出 JSON 数组，schema：

```json
{
  "issues": [
    {
      "axis": "logic|voice|canon|...",
      "severity": "critical|warning|info",
      "title": "...",
      "description": "...",
      "evidence": "引用具体段落",
      "proposed_fix": "建议修法",
      "scope": "paragraph|scene|chapter|volume",
      "scope_details": { "...": "..." }
    }
  ]
}
```

---

#### T-4.37-4.39 Fixer 类 prompt（自动修）

| ID | 文件 | 用途 |
|---|---|---|
| T-4.37 | `prompts/agents/fixer/slop.md` | 替换 AI 味词 |
| T-4.38 | `prompts/agents/fixer/canon.md` | 修正与 canon 矛盾段落 |
| T-4.39 | `prompts/agents/fixer/continuity.md` | 修连续性 bug |

---

#### T-4.40-4.45 Memory / Time / 元 类 prompt

| ID | 文件 |
|---|---|
| T-4.40 | `prompts/agents/world_tick.md` |
| T-4.41 | `prompts/agents/observation_compressor.md` |
| T-4.42 | `prompts/agents/reflection.md` |
| T-4.43 | `prompts/agents/content_safety_router.md` |
| T-4.44 | `prompts/agents/episodic_extractor.md` |
| T-4.45 | `prompts/agents/timeline_event_extractor.md` |

---

#### T-4.46-4.49 Genre profile 补全

**状态**：⚪ 5 个 + 2 个缺
**文件**：

| ID | 文件 |
|---|---|
| T-4.46 | `prompts/genre_profiles/universal.json`（必须，作为 fallback） |
| T-4.47 | `prompts/genre_profiles/horror.json` |
| T-4.48 | `prompts/genre_profiles/wuxia.json`（武侠，区别于仙侠） |
| T-4.49 | `prompts/genre_profiles/historical.json` |

---

#### T-4.50-4.53 Slop dictionaries 增强

| ID | 文件 |
|---|---|
| T-4.50 | `prompts/slop_dictionaries/chinese_general.json` 扩展（现 20+，目标 100+） |
| T-4.51 | `prompts/slop_dictionaries/chinese_xianxia.json`（仙侠特化） |
| T-4.52 | `prompts/slop_dictionaries/chinese_romance.json` |
| T-4.53 | `prompts/slop_dictionaries/english_general.json` |

每个文件包含分类：cliche / ai_tell / over_explain / empty_emotion / repetition / sentence_pattern。

---

## Part 5: Mastra Agents（25+ 个）

### 模块：Mastra

每个 agent 都是一个独立文件 + 对应 prompt + 注册到 `allAgents`。

---

#### T-5.1 Agent factory 框架

**状态**：✗
**操作**：NEW
**文件**：`src/mastra/agents/_factory.ts`
**Deps**：T-1.3、T-1.5

```ts
export interface AgentDef<V extends Record<string, unknown>> {
  name: string
  promptFile: string  // 'agents/chapter-draft.md'
  modelTask: ModelTask
  tools?: Tool[]
  memory?: Memory
  defaultStreaming?: boolean
}

export function defineAgent<V>(def: AgentDef<V>) {
  return {
    create(vars: V): Agent { ... },     // 每次 vars 不同时创建新实例
    async generate(vars: V, opts?: ...): Promise<{ text: string; ... }> { ... },
    async stream(vars: V, opts?: ...): Promise<{ stream: ..., done: ... }> { ... },
    meta: def
  }
}

// 在 src/mastra/agents/index.ts
export const allAgents = {
  chapterDraft: createChapterDraftAgent,
  // ...
}
```

---

#### T-5.2 ChapterDraftAgent（重写）

**状态**：⚠️ 当前简单版本
**操作**：REWRITE
**文件**：`src/mastra/agents/chapter-draft.ts`
**Deps**：T-5.1、T-4.5、T-6.x（tools）

**接口**：

```ts
export interface ChapterDraftVars {
  projectTitle: string
  genre: string
  voiceCard: string
  genreContract: string
  volumeNum: number
  volumeTitle: string
  volumeThesis: string
  arcPosition: string
  prevSummary: string
  chapterOutline: string
  chapterTitle: string
  charactersPresent: CharacterPrivateView[]  // 含 secret_motive
  bibleExtract: string
  hiddenEvents: string
  hintedEvents: string
  revealedEvents: string
  targetWordCount: number
  povCharacterName: string
  povType: string
  deliversArcBeats: string
  hookIntent: string
  slopBlacklistTop20: string
}

export const chapterDraft = defineAgent<ChapterDraftVars>({
  name: 'chapter-draft',
  promptFile: 'agents/chapter_draft.md',
  modelTask: 'draft',
  tools: [searchBible, getCharacterProfile, getActiveVoiceCard],
  defaultStreaming: true,
})
```

---

#### T-5.3-5.27 其他 24 个 agent

每个 agent 一条任务，按下面表格补全。每条都是 NEW 或 REWRITE，都依赖 T-5.1 框架和对应的 prompt 文件 + tool 文件。

| ID | Agent | 操作 | 关键 vars / 输出 |
|---|---|---|---|
| T-5.3 | premiseAgent | REWRITE | 输出 3 个差异化命题 |
| T-5.4 | volumeOutlineAgent | REWRITE | 三幕弧 + arc_beats |
| T-5.5 | chapterOutlineAgent | REWRITE | N 章细纲 + scene markers |
| T-5.6 | chapterSummaryAgent | REWRITE | short + long + key events + reader Q |
| T-5.7 | hookAgent | REWRITE | 重写章末段强化钩子 |
| T-5.8 | sectionRewriterAgent | REWRITE | 段落定向重写 |
| T-5.9 | scenifyAgent (a.k.a NarratorAgent) | NEW | 推演剧本 → 小说文体 |
| T-5.10 | bibleExtractAgent | REWRITE | 章节 → canon facts + entries |
| T-5.11 | characterProfilePrincipalAgent | NEW | 完整 principal 档案 |
| T-5.12 | characterProfileRecurringAgent | NEW | 中等档案 |
| T-5.13 | walkonInlineAgent | NEW | 即时生成路人 |
| T-5.14 | voiceExtractAgent | NEW | 样本 → voice card |
| T-5.15 | knowledgeDiffAgent | NEW | 推演后 → 角色知识 delta |
| T-5.16 | relationshipUpdateAgent | NEW | 关系矩阵更新 |
| T-5.17 | promotionEvaluatorAgent | NEW | walk-on 升级建议 |
| T-5.18 | arcProgressAgent | NEW | 角色弧进度评估 |
| T-5.19 | voiceDriftDetectorAgent | NEW | 角色声音漂移检测 |
| T-5.20 | directorAgent | REWRITE（从 _unused） | 推演导演 |
| T-5.21 | characterAgentFactory | REWRITE（从 _unused） | createCharacterAgent (per-char) |
| T-5.22 | costEstimatorAgent | NEW | 推演成本预估 |
| T-5.23 | sceneRecapAgent | NEW | 推演完小结 |
| T-5.24 | worldTickAgent | NEW | 章节间事件生成 |
| T-5.25 | observationCompressorAgent | NEW | Mastra Observer 配套 |
| T-5.26 | reflectionAgent | NEW | Mastra Reflector 配套 |
| T-5.27 | safetyRouterAgent | NEW | 内容审查路由判断 |
| T-5.28 | episodicExtractorAgent | NEW | 章节 → 角色 episodic memory |
| T-5.29 | timelineEventExtractorAgent | NEW | 章节 → timeline_events |
| T-5.30 | promptDiffAdvisorAgent | NEW | A/B 实验结果分析 |

---

#### T-5.31-5.41 Reviewer agents（拆分 + 完善）

**状态**：⚠️ 当前 8 个挤在一个文件，且 0 调用
**操作**：拆分 + REWRITE
**文件**：每个 reviewer 一个文件 `src/mastra/agents/reviewers/{name}.ts`

| ID | Reviewer | Prompt |
|---|---|---|
| T-5.31 | logicReviewer | T-4.26 |
| T-5.32 | voiceReviewer | T-4.27 |
| T-5.33 | canonReviewer | T-4.28 |
| T-5.34 | pacingReviewer | T-4.29 |
| T-5.35 | themeReviewer | T-4.30 |
| T-5.36 | genreReviewer | T-4.31 |
| T-5.37 | readerSimulatorReviewer | T-4.32 |
| T-5.38 | slopReviewer | T-4.33 |
| T-5.39 | volumeReviewer | T-4.34 |
| T-5.40 | continuityReviewer | T-4.35 |
| T-5.41 | relationshipReviewer | T-4.36 |

每个 reviewer 都注册到 `allAgents.reviewers.{name}`，由 ReviewWorkflow 并发调用。

---

#### T-5.42-5.44 Fixer agents

| ID | Fixer | Prompt |
|---|---|---|
| T-5.42 | slopFixer | T-4.37 |
| T-5.43 | canonFixer | T-4.38 |
| T-5.44 | continuityFixer | T-4.39 |

---

## Part 6: Mastra Tools（30+ 个）

### 模块：Mastra

---

#### T-6.1 Tool factory + RequestContext 设计

**状态**：✗
**操作**：NEW
**文件**：`src/mastra/tools/_factory.ts`
**Deps**：无

```ts
export interface ToolContext {
  projectId: string
  volumeId?: string
  chapterId?: string
  characterId?: string
  jobId?: string
  userId: string
}

export function defineTool<I, O>(opts: {
  id: string
  description: string
  inputSchema: z.ZodSchema<I>
  outputSchema: z.ZodSchema<O>
  execute: (input: I, ctx: ToolContext) => Promise<O>
}): Tool

export const toolRegistry: Record<string, Tool>
```

所有 tool 通过 `defineTool` 创建，自动接 RequestContext + 写 `tool_calls` 表。

---

#### T-6.2-6.40 Tool 详细清单

按 SYSTEM-DESIGN.md §6 完整列出。当前 8 个，目标 35+。

##### Bible / World tools

| ID | Tool | 用途 |
|---|---|---|
| T-6.2 | searchBible | RAG 检索 bible（重写 ⚠️） |
| T-6.3 | getCanonFacts | 拉硬事实（已 ✓） |
| T-6.4 | getCanonByChapter | 按章节查 canon |
| T-6.5 | proposeCanonFact | 提议新硬事实（→issue 或 auto-add） |
| T-6.6 | proposeWorldEntry | 提议新世界条目 |
| T-6.7 | getFactionRelations | 取势力矩阵 |
| T-6.8 | proposeFactionChange | 提议关系变化 |
| T-6.9 | getTimelineEvents | 时间线事件 |

##### Character tools

| ID | Tool | 用途 |
|---|---|---|
| T-6.10 | getCharacterProfile | 已 ✓，扩展 viewerCharacterId 隐私过滤 |
| T-6.11 | getCharacterRoster | 角色名册按 tier |
| T-6.12 | getCharacterKnowledge | 知识档案 |
| T-6.13 | searchOwnEpisodicMemory | 角色自己的记忆检索 |
| T-6.14 | searchPreviousScripts | 该角色历史剧本 |
| T-6.15 | getRelationshipsTo | 关系查询 |
| T-6.16 | getObservedBehavior | 公开行为 |
| T-6.17 | getCharacterVoiceCard | 角色声音卡 |
| T-6.18 | getCharacterVoiceAnchors | voice 样本 |
| T-6.19 | proposeKnowledgeUpdate | 知识 delta 写回 |
| T-6.20 | proposeRelationshipChange | 关系 delta |
| T-6.21 | recordCharacterAppearance | 出场记录 |

##### Outline / Generation tools

| ID | Tool | 用途 |
|---|---|---|
| T-6.22 | getVolumeArc | 卷弧 |
| T-6.23 | getChapterOutline | 章节细纲 |
| T-6.24 | getNextChapterOutline | 下章 |
| T-6.25 | getRecentSummaries | 已 ✓ |
| T-6.26 | getRecentScripts | 含某些角色的历史剧本 |

##### Style / Voice tools

| ID | Tool | 用途 |
|---|---|---|
| T-6.27 | getActiveVoiceCard | 已 ⚪，重写 |
| T-6.28 | getProjectVoiceMd | 项目主声音 |
| T-6.29 | getGenreProfile | 已 ✓ |
| T-6.30 | getSlopBlacklist | 黑名单 |
| T-6.31 | getStyleFingerprint | 文风指纹 |

##### Time tools

| ID | Tool | 用途 |
|---|---|---|
| T-6.32 | getWorldClockState | 已 ✓ |
| T-6.33 | getBetweenChapterEvents | 期间事件 |
| T-6.34 | proposeWorldEvent | 提议事件 |

##### Simulation tools

| ID | Tool | 用途 |
|---|---|---|
| T-6.35 | endScene | 标记结束 |
| T-6.36 | injectEvent | 注入事件 turn |

##### Review / Issue tools

| ID | Tool | 用途 |
|---|---|---|
| T-6.37 | addIssue | 已 ⚪，扩展 schema 支持 |
| T-6.38 | applySectionRewrite | 段落重写并落库 |

##### Cost / Model tools

| ID | Tool | 用途 |
|---|---|---|
| T-6.39 | getModelPricing | 拉价格 |
| T-6.40 | getProviderRoutes | 排序候选 provider |

---

## Part 7: Mastra Workflows（12+ 个）

### 模块：Mastra

---

#### T-7.1 Workflow factory

**状态**：✗
**操作**：NEW
**文件**：`src/mastra/workflows/_factory.ts`
**Deps**：T-3.7

定义 workflow 通用骨架：自动 startJob/completeJob、step 失败重试、断点续跑、SSE 流式输出。

---

#### T-7.2 ProjectBootstrapWorkflow

**状态**：✗
**操作**：NEW
**文件**：`src/mastra/workflows/project-bootstrap.ts`
**Deps**：T-5.3、T-5.4、T-5.11、T-5.5

```ts
trigger: { projectId, seed, genre }
steps:
  1. premise: 流式生成 3 候选 → SSE
  2. WAIT user 选 1 个（外部信号）
  3. volumeOutline: 卷一弧
  4. WAIT user 确认
  5. characterProfilePrincipal × N: 主要角色
  6. WAIT user 编辑
  7. chapterOutline × M: 卷一前 M 章
  8. WAIT user 确认
  9. 写入 DB
output: { volumeId, chapterCount }
```

实现关键：Mastra workflow 的 `suspend / resume` 模式实现 WAIT。

---

#### T-7.3 ChapterGenerationWorkflow（重写）

**状态**：⚠️ 当前简化版
**操作**：REWRITE
**文件**：`src/mastra/workflows/chapter-generation.ts`
**Deps**：T-5.2、T-5.6、T-5.7、T-5.10、T-5.24、T-5.28、T-7.7（review trigger）

```ts
trigger: { chapterId, options? }
steps (流式):
  1. load-context (parallel):
     - getChapterOutline
     - getRecentSummaries (3)
     - searchBible (relevant)
     - getCharacterProfiles (for present)
     - getActiveVoiceCard
     - getGenreProfile
     - getWorldClockState
     - getBetweenChapterEvents
  2. draft (STREAMING via chapterDraft agent):
     - 每 token 写入 stream
     - 每 500 token flush 到 chapter_versions.draft_md (transient)
     - 流结束保存最终版
  3. summarize: chapterSummary agent
  4. extract-hook: hook agent (条件: 章末钩子弱)
  5. embed-chunks: 切块 + embed → chapter_chunks
  6. extract-episodic: per character episodic memory
  7. extract-timeline: timeline events
  8. world-tick (异步): worldTick workflow
  9. bible-extract (异步): bibleExtraction workflow
  10. review (异步): review workflow

output: { versionId, summary, hook }
```

---

#### T-7.4 SimulationWorkflow（重写）

**状态**：⚠️ 当前无知识隔离
**操作**：REWRITE
**文件**：`src/mastra/workflows/simulation.ts`
**Deps**：T-5.20、T-5.21、T-5.9、T-5.15、T-5.16、T-5.23、T-3.10

```ts
trigger: {
  sceneMarkerId,
  characterIds: string[],
  directorGoal: string,
  povChoice: string,
  maxTurns: number,
  injectionsPredefined?: { afterTurn: number; eventText: string }[]
}

steps:
  1. setup:
     - 创建 simulation 行
     - 快照 character_knowledge → simulation_character_states.pre_*
     - 实例化 N 个 CharacterAgent (per-character thread_id)
     - 实例化 1 个 DirectorAgent
     - 初始化 visibleTurns map: { characterId → [] }

  2. simulation_loop (max maxTurns):
     - DirectorAgent.decide({
         goalProgress, turnHistory: 全局视角,
         characterStates: 全局
       })
       output: { action: speak|inject|end, targetId, reasoning }

     - if speak:
         CharacterAgent[targetId].respond({
           selfProfile,             // 含 secret_motive
           selfMemory: episodic search,
           visibleTurns: visibleTurns[targetId],   // ← 关键：仅自己可见
           observableBehaviorHistory  // 其他角色公开行为
         })
         output: { utterance, reasoning, emotionalShift, visibleTo? }

         turn = {
           speakerType: 'character', speakerId, utterance, reasoning,
           visibleTo: visibleTo ?? [characterIds]   // 默认全员看到 utterance
         }

         simulationTurns.insert(turn)

         // 关键：广播 utterance 给所有 visibleTo 中的角色，但 reasoning 只给自己
         for (const cid of turn.visibleTo) {
           visibleTurns[cid].push({ ...turn, reasoning: cid === speakerId ? turn.reasoning : null })
         }

         SSE: emit turn_end

     - if inject:
         turn = { speakerType: 'injection', ... }
         simulationTurns.insert(turn)
         broadcast 给所有
         SSE: emit inject

     - if end: break

  3. knowledge-diff (per character):
     KnowledgeDiffAgent.run({ pre: pre_knowledge, turns: visibleTurns[cid] })
     → simulation_character_states.knowledge_delta + characters table 更新

  4. relationship-update:
     RelationshipUpdateAgent.run({ turns, charactersInvolved })
     → character_relationships 更新提议（写 issues 等用户确认）

  5. script-finalize:
     - 整理 turns → script_md
     - 整体 + 按角色切片 embed
     - simulation_scripts.insert
     - script_character_chunks.insert × N

  6. scenify (optional):
     scenifyAgent.run({ scriptMd, povChoice, voiceCard, genreProfile })
     → 输出小说体段落，写入 chapter_versions (source: simulation_inserted)

  7. episodic-update:
     per character: episodicExtractorAgent.run + character_episodic_memory.insert

output: { simulationId, scriptMd, scenifiedTextMd?, totalCost }
```

**关键约束**：
- 每个 character agent 使用独立 thread_id (`{projectId}:char:{characterId}:sim:{simulationId}`)，跨场推演通过项目级 thread 复用
- visibleTurns map 必须严格按 visible_to 过滤
- reasoning 字段只对 speaker 自己持久（其他角色看到的版本是 reasoning=null）

---

#### T-7.5 ReviewWorkflow

**状态**：⚪ 当前 stub
**操作**：REWRITE
**文件**：`src/mastra/workflows/review.ts`
**Deps**：T-5.31 到 T-5.41、T-5.42 到 T-5.44

```ts
trigger: { scope: 'chapter'|'volume', scopeId, options?: { lightMode?: boolean } }

steps:
  1. select reviewers: lightMode → [logic, voice, slop]; 否则全部
  2. concurrent-run (Promise.all): 每个 reviewer 独立跑
  3. collect issues: 合并所有 reviewer 输出，去重
  4. classify auto-fixable:
     - critical + (canon | aislop | continuity) → 进 auto-fix
     - 其余 → 写 issues 表 status=open
  5. auto-fix-loop:
     - for each fixable issue:
       - 调对应 fixer agent
       - apply patch
       - 重新跑 affected reviewer 验证
       - 如失败，attempt_idx++，最多 2 次
       - 2 次失败 → 升级为 warning, status=open
  6. record review_run:
     - reviewers_invoked, total_issues_found, total_critical, duration, cost

output: { issuesOpen, issuesAutoFixed, issuesEscalated }
```

---

#### T-7.6 RewriteWorkflow

**状态**：✗
**操作**：NEW
**文件**：`src/mastra/workflows/rewrite.ts`
**Deps**：T-5.8、T-7.5

```ts
trigger: { chapterId, range: {start, end}, reason?, targetStyle? }

steps:
  1. load-context: 段落前后 500 字 + 章节 outline + voice card
  2. rewrite (streaming): sectionRewriter agent
  3. show-diff: 写入 chapter_versions (source: rewrite)，UI 渲染 diff
  4. WAIT user accept|reject|retry
  5. if accept: set active_version, 触发 review (only if 改动 > 30%)
  6. if retry: goto 2 with userFeedback
  7. if reject: discard

output: { newVersionId|null }
```

---

#### T-7.7 VolumeFinalizationWorkflow

**状态**：✗
**操作**：NEW
**文件**：`src/mastra/workflows/volume-finalization.ts`
**Deps**：T-5.39（volumeReviewer）

```ts
trigger: { volumeId }

steps:
  1. check-all-chapters-finalized: if not, fail with reason
  2. volume-review: volumeReviewer agent
  3. if critical issues found:
       return { canFinalize: false, blockingIssues }
  4. set volume.status = done, finalized_at = now
  5. trigger ExportWorkflow (auto epub backup)
  6. propose next volume bootstrap

output: { canFinalize, archiveUrl?, nextVolumePremiseSuggestions? }
```

---

#### T-7.8 WorldTickWorkflow

**状态**：✗
**操作**：NEW
**文件**：`src/mastra/workflows/world-tick.ts`
**Deps**：T-5.24

```ts
trigger: { afterChapterId }

steps:
  1. load-state: world_clock + factions + character locations
  2. compute-time-advance: 从 chapter summary 推断时间流逝
  3. tick: worldTickAgent.run({ state, timeAdvance })
     → 0-3 个 between_chapter_events
  4. faction-movements (条件): 如果世界事件涉及势力，更新 faction_movements
  5. update world_clock.current_world_date

output: { eventsCreated, dateAdvancedTo }
```

---

#### T-7.9 BibleExtractionWorkflow

**状态**：✗
**操作**：NEW
**文件**：`src/mastra/workflows/bible-extraction.ts`
**Deps**：T-5.10

```ts
trigger: { chapterId }

steps:
  1. extract: bibleExtractAgent.run({ chapterText })
     → { canonFacts: [], worldEntries: [], timelineEvents: [] }
  2. classify auto-add vs propose:
     - 已存在条目的更新 → propose（写 issue 等用户确认）
     - 全新条目（principal 角色相关） → propose
     - 全新条目（明显 walk-on）→ auto-add
     - canon facts → 全部 propose（永远不自动加 canon）
  3. embed: 新条目 embedding
  4. write to issues table or DB

output: { autoAdded, proposed, issuesCreated }
```

---

#### T-7.10 ExportWorkflow

**状态**：✗
**操作**：NEW
**文件**：`src/mastra/workflows/export.ts`
**Deps**：T-3.13

```ts
trigger: { projectId, scope, scopeId, format: 'md'|'epub'|'docx'|'pdf', config? }

steps:
  1. load-content: 按 scope 拼装所有 final_md
  2. apply-config: 章节命名、字体、目录
  3. transform:
     - md: 直接拼接
     - epub: 调 pandoc
     - docx: 调 pandoc
     - pdf: pandoc + LaTeX template
  4. save to /exports/
  5. update exports table

output: { downloadUrl, fileSize }
```

---

#### T-7.11 RegenerationCascadeWorkflow

**状态**：✗
**操作**：NEW
**文件**：`src/mastra/workflows/regeneration-cascade.ts`
**Deps**：T-7.3、T-2.18

```ts
trigger: { chapterId, newVersionId }

steps:
  1. compute-impact: 比较新旧 version 的指纹
  2. find-downstream: 查 version_dependencies 找受影响章节
  3. classify-impact:
     - low: 摘要变化 → 仅重新生成下一章摘要的部分
     - medium: 角色状态变化 → 重新生成下游 N 章的细纲
     - high: canon 变化 → 必须重新生成下游章节
  4. WAIT user 选 (auto-regenerate | manual review)
  5. if auto: 依次跑 ChapterGenerationWorkflow

output: { affectedChapters, regeneratedChapters }
```

---

#### T-7.12 PromptExperimentWorkflow

**状态**：✗
**操作**：NEW
**文件**：`src/mastra/workflows/prompt-experiment.ts`
**Deps**：T-2.14

```ts
trigger: { experimentId }

每次 agent 调用前：决定走 A 还是 B（按 split_ratio）
N 次调用后或定时 → 评估 metric（用户接受率、issue 数）→ 决定 winner
```

---

## Part 8: API 路由补全

### 模块：API

---

#### T-8.1 流式 SSE 框架统一

**状态**：⚪
**操作**：NEW + PATCH
**文件**：`src/lib/api/sse.ts`
**Deps**：T-3.9

提供统一 SSE 响应工具：

```ts
export function streamWorkflow<T>(workflow: Workflow, input: T, abortSignal: AbortSignal): Response
```

所有流式路由使用同一实现，避免散乱。

---

#### T-8.2-8.30 现有路由重写或扩展

| ID | 路由 | 当前 | 操作 |
|---|---|---|---|
| T-8.2 | `POST /api/projects` | ⚪ | EXTEND（触发 ProjectBootstrap） |
| T-8.3 | `GET /api/projects` | 应有 | NEW（项目列表） |
| T-8.4 | `GET /api/projects/[id]` | ✗ 仅有更新 | NEW |
| T-8.5 | `PATCH /api/projects/[id]` | ⚪ | 项目设置更新 |
| T-8.6 | `DELETE /api/projects/[id]` | ✗ | NEW |
| T-8.7 | `POST /api/projects/[id]/bootstrap` | ✗ | NEW（resume bootstrap） |
| T-8.8 | `GET/POST /api/projects/[id]/volumes` | ⚪ | EXTEND |
| T-8.9 | `GET/PATCH /api/volumes/[id]` | ✗ | NEW |
| T-8.10 | `POST /api/volumes/[id]/finalize` | ✗ | NEW |
| T-8.11 | `POST /api/volumes/[id]/start` | ✗ | NEW |
| T-8.12 | `POST /api/chapters/[id]/generate` (SSE) | ⚠️ | REWRITE |
| T-8.13 | `POST /api/chapters/[id]/save` | ✓ | 保留 |
| T-8.14 | `POST /api/chapters/[id]/finalize` | ⚠️ stub | REWRITE（真触发后续） |
| T-8.15 | `POST /api/chapters/[id]/rewrite` (SSE) | ⚪ | REWRITE |
| T-8.16 | `POST /api/chapters/[id]/summarize` | ⚪ | EXTEND |
| T-8.17 | `POST /api/chapters/[id]/review` | ⚪ | EXTEND（触发 ReviewWorkflow） |
| T-8.18 | `GET/POST /api/chapters/[id]/versions` | ⚪ | EXTEND |
| T-8.19 | `POST /api/chapters/[id]/switch-version` | ✗ | NEW（触发 cascade） |
| T-8.20 | `GET/POST /api/projects/[id]/characters` | ⚪ | EXTEND |
| T-8.21 | `GET/PATCH/DELETE /api/projects/[id]/characters/[charId]` | ⚪ | EXTEND |
| T-8.22 | `POST /api/projects/[id]/characters/[charId]/promote` | ✗ | NEW |
| T-8.23 | `POST /api/projects/[id]/characters/[charId]/extract-voice` | ✗ | NEW |
| T-8.24 | `GET/POST /api/projects/[id]/bible` | ⚪ | EXTEND |
| T-8.25 | `GET/POST /api/projects/[id]/factions` | ⚪ | EXTEND |
| T-8.26 | `GET/POST /api/projects/[id]/timeline` | ✗ | NEW |
| T-8.27 | `GET/POST /api/projects/[id]/issues` | ⚪ | EXTEND |
| T-8.28 | `POST /api/issues/[id]/apply-fix` | ✗ | NEW |
| T-8.29 | `POST /api/issues/[id]/dismiss` | ✗ | NEW |
| T-8.30 | `POST /api/issues/[id]/comment` | ✗ | NEW |

---

#### T-8.31-8.50 新增路由

| ID | 路由 | 操作 |
|---|---|---|
| T-8.31 | `POST /api/simulations` | EXTEND（启动 SimulationWorkflow） |
| T-8.32 | `GET /api/simulations/[id]` | NEW |
| T-8.33 | `GET /api/simulations/[id]/stream` (SSE) | NEW |
| T-8.34 | `POST /api/simulations/[id]/inject` | NEW |
| T-8.35 | `POST /api/simulations/[id]/pause` | NEW |
| T-8.36 | `POST /api/simulations/[id]/resume` | NEW |
| T-8.37 | `POST /api/simulations/[id]/end` | NEW |
| T-8.38 | `POST /api/simulations/[id]/scenify` | NEW |
| T-8.39 | `POST /api/simulations/[id]/insert-into-chapter` | NEW |
| T-8.40 | `POST /api/projects/[id]/cost-estimate` | NEW |
| T-8.41 | `GET /api/projects/[id]/style/voice-cards` | NEW |
| T-8.42 | `POST /api/projects/[id]/style/voice-cards` | NEW |
| T-8.43 | `GET/PATCH /api/projects/[id]/style/slop-blacklist` | NEW |
| T-8.44 | `GET /api/projects/[id]/style/drift` | NEW |
| T-8.45 | `GET /api/jobs/[id]` | NEW |
| T-8.46 | `GET /api/jobs/[id]/trace` | NEW |
| T-8.47 | `GET /api/jobs/[id]/replay` | NEW |
| T-8.48 | `GET /api/projects/[id]/observability/stats` | NEW |
| T-8.49 | `GET/PATCH /api/prompts` | NEW |
| T-8.50 | `POST /api/prompts/experiments` | NEW |

---

#### T-8.51-8.55 World tick / Export 路由

| ID | 路由 | 操作 |
|---|---|---|
| T-8.51 | `POST /api/projects/[id]/world-tick` | EXTEND |
| T-8.52 | `GET /api/projects/[id]/between-events` | NEW |
| T-8.53 | `POST /api/projects/[id]/export` | EXTEND |
| T-8.54 | `GET /api/exports/[id]` | NEW |
| T-8.55 | `GET /api/exports/[id]/download` | NEW |

---

## Part 9: UI 页面深化

### 模块：UI

当前 14 个 page.tsx 大多是 placeholder。每条任务都是把对应页面做成"真正能用"的状态。

---

#### T-9.1 全局布局 + 项目头

**状态**：⚪
**操作**：REWRITE
**文件**：`src/app/projects/[id]/layout.tsx`、`src/components/layout/{ProjectShell,ProjectNav,TopBar,IssueBadge,CostMeter}.tsx`
**Deps**：T-8.x

布局：左侧导航 + 顶部状态栏（项目名、月度 token 用量条、issue 红点、AI 思考状态）

---

#### T-9.2 项目列表页

**状态**：⚪
**操作**：REWRITE
**文件**：`src/app/projects/page.tsx`
**Deps**：T-8.3

卡片网格 + 类型筛选 + 字数 / 进度统计。

---

#### T-9.3 创建项目向导

**状态**：⚪
**操作**：REWRITE
**文件**：`src/app/projects/new/page.tsx` + `src/components/setup/*.tsx`
**Deps**：T-8.2

字段：标题、类型选择（带 profile 描述）、种子（textarea）、安全级别。

---

#### T-9.4 项目启动向导（多步骤 + 流式）

**状态**：⚪
**操作**：REWRITE
**文件**：`src/app/projects/[id]/setup/page.tsx`
**Deps**：T-7.2

四步：premise → volume_outline → characters → chapter_outline。每步流式生成、用户编辑、确认。

---

#### T-9.5 项目仪表盘

**状态**：⚪
**操作**：REWRITE
**文件**：`src/app/projects/[id]/page.tsx`
**Deps**：T-8.x

显示：当前卷进度、最近章节、issue 摘要、cost 月度、最近活动 timeline。

---

#### T-9.6 卷视图（看板 + 大纲）

**状态**：⚪
**操作**：REWRITE
**文件**：`src/app/projects/[id]/volumes/page.tsx`、`src/app/projects/[id]/volumes/[volId]/page.tsx`（NEW）
**Deps**：T-8.8、T-8.9

卷列表 + 单卷视图（卷弧图 + 章节卡片 + finalize 按钮）。

---

#### T-9.7 章节编辑器（核心页面）

**状态**：⚪
**操作**：REWRITE（大改）
**文件**：`src/app/projects/[id]/chapters/[chId]/page.tsx`、`src/components/editor/*.tsx`
**Deps**：T-8.12、T-8.13、T-8.14、T-8.15、T-8.18、T-8.19

布局：

```
┌─────────────────────────────────────────────────────────────────┐
│ 顶栏: 章节切换 / 版本切换 / 设置 / 生成按钮                          │
├──────────┬─────────────────────────────────┬────────────────────┤
│          │                                  │                    │
│ 左侧     │      Tiptap 编辑器                │  右侧 Tab          │
│          │                                  │                    │
│ 章节细纲 │      流式 token 实时显示          │  bible 摘录        │
│ scene    │      段落级 hover 操作            │  人物档案          │
│ markers  │      选中文本 → 重写菜单           │  issues            │
│          │                                  │  推演入口          │
│ 推演入口 │                                  │  历史版本          │
│          │                                  │                    │
├──────────┴─────────────────────────────────┴────────────────────┤
│ 底栏: 字数 / 状态 / 流式进度 / cancel / save                       │
└─────────────────────────────────────────────────────────────────┘
```

子组件：
- `ChapterEditor.tsx` (Tiptap 主体)
- `OutlinePanel.tsx`
- `BibleSidebar.tsx`
- `CharacterSidebar.tsx`
- `IssueSidebar.tsx`
- `VersionHistory.tsx`
- `SimulationLauncher.tsx`
- `RewriteFloatingMenu.tsx`
- `StreamingProgress.tsx`

---

#### T-9.8 角色管理页

**状态**：⚪
**操作**：REWRITE
**文件**：`src/app/projects/[id]/characters/page.tsx`、`src/app/projects/[id]/characters/[charId]/page.tsx`（NEW）
**Deps**：T-8.20、T-8.21、T-8.22、T-8.23

三 tab（principal / recurring / walk_on）+ 升级建议 badge + 关系图（D3 force layout）+ 单角色页（档案、知识、关系、出场记录、声音卡、声音锚点）。

---

#### T-9.9 Bible / 世界观页

**状态**：⚪
**操作**：REWRITE
**文件**：`src/app/projects/[id]/bible/page.tsx`、子页面
**Deps**：T-8.24、T-8.25、T-8.26

四 tab：canon facts / world entries / factions（关系矩阵） / timeline。

---

#### T-9.10 推演中心

**状态**：⚪
**操作**：REWRITE
**文件**：`src/app/projects/[id]/simulations/page.tsx`、`/simulations/[simId]/page.tsx`（NEW）
**Deps**：T-8.31 到 T-8.39

历史推演列表 + 单场推演回放（多气泡列：导演 / 各角色 / 旁观）+ 实时推演视图（流式 + 控制按钮）。

---

#### T-9.11 Issue 中心（GitHub 风格）

**状态**：⚪
**操作**：REWRITE
**文件**：`src/app/projects/[id]/issues/page.tsx`、`src/components/issues/*.tsx`
**Deps**：T-8.27 到 T-8.30

四列看板（open / in_progress / resolved / dismissed）+ 过滤（axis / severity / scope）+ 单 issue 详情面板 + 一键应用 fix / diff 预览。

---

#### T-9.12 文风管理页

**状态**：⚪
**操作**：REWRITE
**文件**：`src/app/projects/[id]/style/page.tsx`、子页面
**Deps**：T-8.41 到 T-8.44

三 tab：voice cards 编辑 / slop blacklist / drift 仪表盘（按章节绘制 fingerprint 折线）。

---

#### T-9.13 可观测性页

**状态**：⚪
**操作**：REWRITE
**文件**：`src/app/projects/[id]/observability/page.tsx`
**Deps**：T-8.45 到 T-8.48

job 列表 + 单 job trace 树 + 月度 cost 分布 + agent 调用统计 + prompt run 回放。

---

#### T-9.14 Prompt 管理页

**状态**：⚪
**操作**：REWRITE
**文件**：`src/app/projects/[id]/prompts/page.tsx`
**Deps**：T-8.49、T-8.50

prompt 列表 + version diff + 创建实验 + 实验结果。

---

#### T-9.15 项目设置页

**状态**：⚪
**操作**：EXTEND
**文件**：`src/app/projects/[id]/settings/page.tsx`
**Deps**：T-8.5

类型、安全级别、模型路由、cost 预算、自动审稿模式、删除项目（带确认）。

---

#### T-9.16 导出页

**状态**：✗
**操作**：NEW
**文件**：`src/app/projects/[id]/exports/page.tsx`
**Deps**：T-8.53 到 T-8.55

历史导出列表 + 创建新导出（范围 + 格式 + 配置）+ 下载链接。

---

## Part 10: 集成（compass / hermes）

### 模块：跨系统

---

#### T-10.1 共享数据库 schema 命名空间

**状态**：✗
**操作**：NEW
**文件**：`src/db/schema/_namespace.ts`
**Deps**：T-2.17

所有 novel 系统的表前缀改为 `novel_`，确保和 compass / hermes 不冲突。

---

#### T-10.2 跨系统 view

**状态**：✗
**操作**：NEW
**文件**：`drizzle/views/*.sql`
**Deps**：T-10.1

```sql
CREATE VIEW novel_writing_sessions AS
SELECT j.created_at, j.duration_ms, p.title
FROM novel_jobs j
JOIN novel_projects p ON p.id = j.project_id
WHERE j.type = 'chapter_generation';
```

让 compass 能读到本系统的数据。

---

#### T-10.3 hermes 可调用 workflow 暴露

**状态**：✗
**操作**：NEW
**文件**：`src/integration/hermes/{workflows.ts,api.ts}`
**Deps**：T-7.x

```ts
export const hermesCallableWorkflows = {
  DailyProgressReport: ...,
  WeeklyReview: ...,
  ChapterGenerateAuto: ...,
}

// 暴露 API：POST /api/integration/hermes/invoke
```

---

#### T-10.4 compass 事件监听

**状态**：✗
**操作**：NEW
**文件**：`src/integration/compass/{listeners.ts}`
**Deps**：T-10.2

监听 compass 的事件：
- 用户专注时长 ≥ X → 自动启动一章生成
- 用户情绪低落 → 暂缓沉重章节生成

---

## Part 11: 测试体系

### 模块：测试

当前 12 个测试文件，多为占位。目标 ~80 个测试文件，5,000-10,000 行。

---

#### T-11.1 测试基础设施

**状态**：⚪
**操作**：EXTEND
**文件**：`vitest.config.ts`、`tests/setup.ts`、`tests/helpers/*.ts`
**Deps**：无

```
tests/helpers/
├── db.ts            # 测试 DB 起停 + 事务回滚
├── llm-mock.ts      # mock LLM 调用（用于单元测试）
├── factories.ts     # 测试数据工厂
├── fixtures/        # 固定输入数据
└── snapshots/       # 输出 snapshot
```

---

#### T-11.2-11.10 lib 单元测试

| ID | 测试文件 | 覆盖 |
|---|---|---|
| T-11.2 | `tests/lib/llm/router.test.ts` | T-3.1（路由策略、fallback） |
| T-11.3 | `tests/lib/embed.test.ts` | T-3.2 |
| T-11.4 | `tests/lib/rag.test.ts` | T-3.3 |
| T-11.5 | `tests/lib/slop-detector.test.ts` (扩展) | T-3.4 |
| T-11.6 | `tests/lib/style-fingerprint.test.ts` (扩展) | T-3.5 |
| T-11.7 | `tests/lib/cost.test.ts` | T-3.6 |
| T-11.8 | `tests/lib/observability/trace.test.ts` | T-3.7 |
| T-11.9 | `tests/lib/safety.test.ts` | T-3.8 |
| T-11.10 | `tests/lib/prompts.test.ts` (扩展) | T-1.3（frontmatter / render / partial） |

---

#### T-11.11-11.15 db 测试

| ID | 测试 |
|---|---|
| T-11.11 | `tests/db/schema.test.ts`（扩展，覆盖所有 45 表） |
| T-11.12 | `tests/db/queries/chapter.test.ts` |
| T-11.13 | `tests/db/queries/character.test.ts` |
| T-11.14 | `tests/db/queries/simulation.test.ts` |
| T-11.15 | `tests/db/seed.test.ts` |

---

#### T-11.16-11.45 mastra 测试（每 agent 一个）

每个 agent 单独测试：
- prompt 渲染正确（无 unfilled）
- 模型调用成功
- 输出 schema 验证（特别是 reviewer / fixer 的 JSON）

---

#### T-11.46-11.65 workflow 端到端测试

每个 workflow 一个集成测试，用 LLM mock 测流程，用真实 LLM 跑 e2e（可选 flag）。

特别关键：
- T-11.55: SimulationWorkflow 的**知识隔离测试** — 验证 character A 看不到 character B 的 reasoning
- T-11.58: ReviewWorkflow 的**自动修两次失败 escalate 测试**
- T-11.60: ChapterGenerationWorkflow 的**流式中断后保留 partial 测试**

---

#### T-11.66-11.75 API 路由测试

每个流式路由都要测：
- 正常流式 → 完整结果
- 中途 abort → partial 已保存
- LLM 失败 → 错误码正确

---

#### T-11.76-11.80 压力测试 / 评测

| ID | 测试 |
|---|---|
| T-11.76 | `tests/eval/slop-rate.test.ts` |
| T-11.77 | `tests/eval/voice-consistency.test.ts` |
| T-11.78 | `tests/eval/canon-violations.test.ts` |
| T-11.79 | `tests/eval/hook-strength.test.ts` |
| T-11.80 | `tests/eval/prompt-ab-replay.test.ts` |

每月跑一次评测，写报告到 dashboard。

---

## Part 12: 部署 / 运维

### 模块：DevOps

---

#### T-12.1 Docker Compose 开发环境

**状态**：✗
**操作**：NEW
**文件**：`docker-compose.dev.yml`、`Dockerfile.dev`
**Deps**：无

```yaml
services:
  postgres: { image: pgvector/pgvector:pg16, ... }
  bge-m3: { image: ..., ports: ['11434:11434'] }
  app: { build: . }
```

---

#### T-12.2 生产部署

**状态**：✗
**操作**：NEW
**文件**：`docker-compose.prod.yml`、`Dockerfile`、`scripts/deploy.sh`、`nginx.conf`
**Deps**：无

---

#### T-12.3 备份脚本

**状态**：✗
**操作**：NEW
**文件**：`scripts/backup.sh`
**Deps**：无

每日 pg_dump + 同步到对象存储 / 异地备份。

---

#### T-12.4 监控告警

**状态**：✗
**操作**：NEW
**文件**：`scripts/cron/{check-cost.ts,check-quota.ts,health.ts}`
**Deps**：T-3.6

cron 检查：
- 月度 cost 接近预算阈值 → 邮件
- 单次 LLM 调用 > $0.50 → log warn
- 长时间 running job > 30 分钟 → 检查是否卡死

---

#### T-12.5 prompt 同步流水线

**状态**：✗
**操作**：NEW
**文件**：`scripts/cron/sync-prompts.ts`
**Deps**：T-2.19

启动时和每次 git pull 后：把 `prompts/` 目录同步到 DB（diff-based，新版本写新行不删旧行）。

---

#### T-12.6 文档

**状态**：⚪
**操作**：NEW
**文件**：`docs/{architecture.md,onboarding.md,prompt-style-guide.md,troubleshooting.md}`
**Deps**：所有

---

## 实施顺序建议

按依赖图谱，最稳妥的顺序：

```
[第一波] P0 急救
  T-1.1 → T-1.2 → T-1.3 → T-1.4 → T-1.5 → T-1.6
  目标：项目能启动，npm run dev 不报错

[第二波] 数据库底座
  T-2.1 → T-2.2 → T-2.3 ~ T-2.16 → T-2.17 → T-2.18 → T-2.19 → T-2.20
  目标：完整 schema，能跑 migration

[第三波] 基础设施
  T-3.1 → T-3.2 → T-3.3 → T-3.6 → T-3.7 → T-3.9
  T-3.4 → T-3.5 → T-3.8 → T-3.10 → T-3.11 → T-3.12 → T-3.13 → T-3.14
  目标：lib 层完备，agent / workflow 有所有底层支撑

[第四波] Prompt 库
  T-4.1（共享）
  T-4.2 ~ T-4.10（generation 类）— 章节生成主路径优先
  T-4.46 ~ T-4.49（genre profile 补全）
  T-4.50 ~ T-4.53（slop 补全）
  目标：章节生成用的 prompt 全部就位

[第五波] Mastra agent + tool 主路径
  T-5.1（factory）
  T-5.2（chapterDraft）→ T-5.6（summary）→ T-5.7（hook）→ T-5.10（bibleExtract）
  T-6.1（factory）
  T-6.2 ~ T-6.40 中"章节生成"链路上需要的（searchBible, getCharacterProfile, getActiveVoiceCard 等）
  T-7.1（factory）→ T-7.3（ChapterGenerationWorkflow）
  T-8.12（generate API） → T-9.7（章节编辑器）
  目标：能从项目页点"生成"看到流式中文出现并落库

[第六波] Bootstrap 链路
  T-5.3 ~ T-5.5（premise / volume_outline / chapter_outline）
  T-4.2 ~ T-4.4 对应 prompt
  T-7.2（ProjectBootstrapWorkflow）
  T-9.4（启动向导）
  目标：能从零创建项目走到第一章生成

[第七波] Character 系统
  T-2.6 ~ T-2.7（appearances / voice_anchors 表）
  T-5.11 ~ T-5.19（character agents）
  T-4.11 ~ T-4.20（character prompts）
  T-6.10 ~ T-6.21（character tools）
  T-9.8（角色页）
  目标：完整角色档案 + 升级建议 + 关系网

[第八波] Bible / RAG
  T-7.9（BibleExtractionWorkflow）
  T-9.9（Bible 页）
  目标：写章节时自动抽取硬事实，下章生成时自动检索

[第九波] Review 系统
  T-5.31 ~ T-5.41（reviewer agents）
  T-5.42 ~ T-5.44（fixer agents）
  T-4.26 ~ T-4.39（reviewer / fixer prompts）
  T-7.5（ReviewWorkflow）
  T-9.11（Issue 中心）
  目标：每章 finalize 后自动审稿 + auto-fix + escalate

[第十波] Style 系统
  T-3.4（slop 增强）+ T-3.5（fingerprint 增强）+ T-3.12（voice 系统）已就位
  T-5.18 ~ T-5.19
  T-9.12（文风页）
  目标：voice 卡管理 + 漂移仪表盘

[第十一波] 推演（最大块）
  T-5.20 ~ T-5.23（director / character / narrator / cost_estimator）
  T-4.21 ~ T-4.25 对应 prompt
  T-6.35 ~ T-6.36（simulation tools）
  T-7.4（SimulationWorkflow，含知识隔离）
  T-8.31 ~ T-8.39（推演 API）
  T-9.10（推演中心）
  目标：能触发推演看到分气泡流式输出，结束后角色档案自动更新

[第十二波] 时间 / 版本 / 导出
  T-7.8（WorldTickWorkflow）+ T-5.24（worldTick agent）
  T-7.11（RegenerationCascade）+ T-8.19（switch-version API）
  T-7.10（ExportWorkflow）+ T-9.16（导出页）

[第十三波] Memory 深化
  T-3.10（episodic store）已就位
  T-5.25 ~ T-5.26（observation / reflection）
  Mastra Memory 配置接入所有长生命周期 agent

[第十四波] Observability
  T-9.13（observability 页）
  T-7.12（PromptExperimentWorkflow）+ T-9.14（prompt 页）
  T-12.4（监控告警）

[第十五波] 集成 + 部署
  T-10.x 与 compass / hermes 集成
  T-12.x 部署 / 备份 / cron

[贯穿全程] 测试
  每完成一个 agent / workflow，立刻补对应测试
  T-11.x 不集中做，分散到每一波
```

---

## 总规模预估

按完整补完：

| 模块 | 当前行数 | 目标行数 | 增量 |
|---|---|---|---|
| src/lib | 330 | ~5,500 | +5,170 |
| src/db | 489 | ~3,000 | +2,511 |
| src/mastra | 1,261 | ~15,000 | +13,739 |
| src/app | 4,267 | ~12,000 | +7,733 |
| src/components | 109 | ~5,000 | +4,891 |
| src/types | 63 | ~1,500 | +1,437 |
| src/integration | 0 | ~1,000 | +1,000 |
| **TS 总计** | **6,519** | **~43,000** | **+36,481** |
| prompts/ | 327 | ~25,000 | +24,673 |
| tests/ | ~1,000 | ~9,000 | +8,000 |
| **总代码量** | **~7,800** | **~77,000** | **+69,200** |

---

## 收尾说明

这份 285 项任务清单是把 SYSTEM-DESIGN.md 落到地上的"工程实施"文档。每条都是一次 vibe coding session 的输入。

**重要的几条注意**：

1. **不要并行做太多波次**。一次开 1-2 波，每波结束做一次"能不能跑"验收（手动 + 测试），过了再开下一波
2. **优先做"主路径"任务**。比如第五波只做"能生成一章"涉及的最小 agent / tool / workflow 集合，剩余的非阻塞
3. **prompt 是核心，认真写**。每个 prompt 至少经过 3 轮迭代——首版能跑、二版去 AI 味、三版加 few-shot。**别让 AI 一次给最终 prompt**
4. **测试不要堆到最后**。每完成一个 agent 立刻写至少一个 happy path 测试。修 bug 时就有依据
5. **死代码绝不留**。每完成一个文件就让它真的被 import 调用。看到 `src/_unused/` 里的文件，要么激活，要么彻底删掉
6. **commit 颗粒度**。每条任务一个 commit，message 写清 `T-X.Y: brief`。这样 6-12 个月后回头看清楚每一步在干什么

完成所有 285 项 = 一个真正能扛住"比肩 hermes"野心的系统。