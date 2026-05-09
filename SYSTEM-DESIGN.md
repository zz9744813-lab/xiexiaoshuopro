# AI 小说创作系统 — 完整架构设计

> 单用户、自部署、Next.js + Mastra + DeepSeek 主导。
> 与 compass / hermes 同级的独立子系统，可双向集成。
> 本文是 spec，不是教程。每一节都对应 vibe coding 时的一个明确实现目标。

---

## 目录

0. 引言：系统定位与设计原则
1. 架构总览
2. 技术栈与依赖
3. Mastra 原语使用细则
4. 模块详细设计（14 个模块）
5. Agent 目录（25+ agents）
6. Tool 目录（20+ tools）
7. Workflow 目录（10+ workflows）
8. 数据库 schema（完整 25+ 表）
9. 关键流程详解（5 个端到端 trace）
10. Prompt 库结构
11. UI 结构与导航
12. API 表面
13. 流式架构
14. 记忆系统
15. Issue 系统
16. 文风系统
17. 世界时钟
18. 版本控制
19. 可观测性
20. 配置、安全、部署
21. 评测体系
22. 扩展点
23. 与 compass / hermes 的集成
24. 附录

---

## 0. 引言

### 0.1 系统定位

本系统是面向**单用户长篇小说创作**的 AI 协同创作平台。区别于市面上的 ChatGPT 套壳：

- **以"故事 bible + 多 agent 协作"为核心**，而非"长文本对话"
- **写作过程是流水线，不是聊天**——多阶段、可审计、可回滚
- **AI 主导生成、人类主导决策**——AI 写绝大部分文字，用户决定方向、审核质量、把握节奏
- **可生成大尺度内容**——使用 DeepSeek 主力 + Qwen 自部署兜底，绕开商用模型审查限制
- **类型无关**——通过 genre profile 注入支持仙侠 / 言情 / 科幻 / 严肃文学等

### 0.2 设计原则

1. **数据驱动 UI**：所有 UI 都是数据库表的视图，业务逻辑在 agent / workflow，不在 React 组件
2. **Prompt 是核心 IP**：版本化、可回放、可对比，单独治理
3. **Agent 解耦**：每个 agent 单一职责，通过 tools 和 workflows 编排，不互相直接调用
4. **流式默认**：用户面前的所有生成都是流式的，watch as it writes
5. **可观测**：每一次 LLM 调用、agent 决策、tool call 都留痕，可回放
6. **可逆**：写错了的章节、推错了的演、改错了的设定，都能回退
7. **不过早抽象**：MVP 只做必要功能，预留扩展点而不预先实现
8. **零 Python 服务**：全 TypeScript 单语言，与 compass 共栈

### 0.3 与 compass / hermes 的关系

```
┌─────────────────────────────────────────────┐
│              用户层 (Next.js)                │
│   compass UI  │  此系统 UI  │  hermes 控制台  │
└─────────────────────────────────────────────┘
                      │
┌─────────────────────────────────────────────┐
│           共享基础设施层                       │
│   Postgres │ pgvector │ Drizzle │ Auth      │
└─────────────────────────────────────────────┘
                      │
┌─────────────────────────────────────────────┐
│          Agent / Workflow 层                 │
│  compass agents │ 此系统 agents │ hermes     │
│           （都通过 Mastra 实现）              │
└─────────────────────────────────────────────┘
                      │
┌─────────────────────────────────────────────┐
│         LLM 提供商抽象层                      │
│  DeepSeek │ Qwen │ Claude │ 自部署 │ ...    │
└─────────────────────────────────────────────┘
```

三个子系统**共享数据库、共享 Mastra runtime、共享 LLM 抽象层**，但有独立的 schema 命名空间和独立的 UI 入口。hermes 可以调用本系统的 agent（例如让 hermes 的某个 routine 触发"写作 30 分钟检查"），本系统也可以调用 hermes 的能力（例如做时间感知的 writing schedule）。

---

## 1. 架构总览

### 1.1 八层架构

```
Layer 8: UI                    Next.js App Router + Tiptap + Tailwind
Layer 7: API                   Server Actions + Route Handlers (SSE)
Layer 6: Workflow              Mastra Workflows
Layer 5: Agent                 Mastra Agents (25+)
Layer 4: Tool                  Mastra Tools (20+)
Layer 3: Memory                Mastra Memory + 自定义 stores
Layer 2: Storage               Postgres + pgvector + Filesystem (chapters MD)
Layer 1: LLM Provider          自定义路由层 → DeepSeek / Qwen / 自部署
```

每层只能调用下一层，不能跨层。Workflow 不直接调 LLM，而是通过 Agent；Agent 通过 Tool 访问 Storage；UI 不直接调 Agent，而是通过 API → Workflow。

### 1.2 14 个核心模块

| 模块 | 职责 | 主要数据 |
|---|---|---|
| Project | 项目生命周期、设置、文风元数据 | projects, project_settings |
| World | Bible、canon、地点、物品、势力、法则 | world_entries, canon_facts, factions |
| Character | 角色档案、知识状态、关系、弧 | characters, character_knowledge, relationships |
| Outline | 命题、卷弧、章节细纲、场景标记 | volumes, chapter_outlines, scene_markers |
| Generation | 章节生成、摘要、钩子、即时改写 | chapters, chapter_versions, drafts |
| Simulation | 多 agent 推演、剧本固化、知识更新 | simulations, simulation_scripts, simulation_states |
| Review | 审稿团、issue 队列、自动修复 | issues, review_runs, fix_attempts |
| Style | voice 卡、AI 味检测、风格锚定 | voice_cards, slop_blacklist, style_samples |
| Memory | 短期 / 长期 / 角色 / 观察记忆 | memory_blocks, observations, reflections |
| Time | 世界时钟、章节间事件 | world_clock, between_chapter_events |
| Version | 章节分支、回退、影响检测 | version_branches, version_links |
| Observability | trace、cost、replay | jobs, traces, llm_calls |
| Export | epub / docx / md 导出 | export_jobs |
| Prompt | 版本化 prompt 库、A/B 实验 | prompts, prompt_runs, prompt_experiments |

### 1.3 模块依赖

```
                    ┌──────────┐
                    │ Project  │
                    └────┬─────┘
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    ┌────────┐     ┌──────────┐    ┌──────────┐
    │ World  │◄────┤Character │    │ Outline  │
    └────┬───┘     └────┬─────┘    └────┬─────┘
         │              │                │
         └──────────────┼────────────────┘
                        ▼
                  ┌──────────┐
                  │Generation│◄──────┐
                  └────┬─────┘       │
                       │             │
         ┌─────────────┼─────────┐   │
         ▼             ▼         ▼   │
    ┌────────┐  ┌──────────┐ ┌─────┴────┐
    │Simulate│  │  Review  │ │ Version  │
    └────────┘  └────┬─────┘ └──────────┘
                     │
                ┌────▼─────┐
                │  Style   │
                └──────────┘

  Memory / Time / Observability / Prompt 横切所有模块
```

---

## 2. 技术栈与依赖

### 2.1 运行时

| 用途 | 选择 | 说明 |
|---|---|---|
| Web 框架 | Next.js 14 (App Router) | 与 compass 共栈 |
| Runtime | Node.js 20 LTS + Edge Runtime | Edge 用于流式 |
| 数据库 | PostgreSQL 16 | 与 compass 共库（不同 schema） |
| 向量扩展 | pgvector ≥ 0.7 | 1024 维向量 |
| ORM | Drizzle ORM | 与 compass 共栈 |
| Agent 框架 | **Mastra** (latest) | 一等公民 |
| 编辑器 | Tiptap | 与 compass 共栈 |
| 富文本存储 | Markdown | 编辑器序列化为 MD |

### 2.2 LLM 提供商

```ts
// 主力
DEEPSEEK_API_KEY        // V3.2 chat + reasoner
QWEN_API_KEY            // 通义千问 Max（备用 + 中文 fallback）

// 可选 fallback
SELF_HOSTED_QWEN_URL    // 自部署 Qwen 32B（终极兜底，不限制内容）
OPENROUTER_API_KEY      // 应急通道，访问 abliterated 模型

// 不使用
ANTHROPIC_API_KEY       // 拒绝率高，仅用于评测对照
OPENAI_API_KEY          // 同上
```

### 2.3 Embedding

```
首选：bge-m3 自部署（Docker，4GB RAM 即可）
       1024 维，中英文双语强
       接 Mastra 自定义 Embedder 接口

备选：Qwen text-embedding API
       省运维，按量付费
```

### 2.4 必备 npm 包

```jsonc
{
  "dependencies": {
    "@mastra/core": "latest",
    "@mastra/memory": "latest",
    "@mastra/rag": "latest",
    "@mastra/pg": "latest",         // Postgres adapter
    "@ai-sdk/openai": "latest",     // OpenAI 兼容协议（DeepSeek 用）
    "ai": "latest",                  // Vercel AI SDK，流式工具
    "drizzle-orm": "latest",
    "pg": "latest",
    "@tiptap/react": "latest",
    "zod": "latest"                  // schema 校验
  }
}
```

不引入 langchain.js / llamaindex.js / autogen-js — 与 Mastra 重复。

### 2.5 不使用的东西（明确）

- ❌ Redis：用 Postgres LISTEN/NOTIFY 即可
- ❌ BullMQ / 任务队列服务：用 Postgres 当队列
- ❌ Docker Compose 编排：单服务部署
- ❌ Kubernetes / 微服务：monolith
- ❌ 独立 Python 服务：全 TS

---

## 3. Mastra 原语使用细则

Mastra 提供 6 个核心原语。我们对每个的使用方式必须**约定清楚**，否则团队（即使只有你一个人）不同时间写出来的代码会风格分裂。

### 3.1 Agent

**Agent = 单个有指令、模型、工具、记忆的执行单元**。

约定：

- 每个 agent 一个文件，路径 `mastra/agents/{name}.ts`
- 文件 export 一个 `xxxAgent` 实例
- 指令（instructions）从 `prompts/agents/{name}.md` 读取，**绝不在 ts 文件里写 prompt**
- 模型从 `lib/models.ts` 的工厂函数读取，**绝不直接 hardcode**
- 不在 agent 里做 DB 查询，所有外部数据通过 tools 注入
- agent 是无状态的，状态在 memory 或 storage 里

```ts
// mastra/agents/chapter-draft.ts
import { Agent } from '@mastra/core'
import { readPromptSync } from '@/lib/prompts'
import { deepseekChat } from '@/lib/models'
import { searchBible, getCharacterProfile, getRecentSummaries } from '../tools'

export const chapterDraftAgent = new Agent({
  name: 'chapter-draft',
  instructions: readPromptSync('agents/chapter-draft.md'),
  model: deepseekChat({ temperature: 0.85 }),
  tools: { searchBible, getCharacterProfile, getRecentSummaries },
  memory: chapterMemory  // 见 §3.4
})
```

### 3.2 Tool

**Tool = agent 可以调用的纯函数，输入输出 schema 严格定义**。

约定：

- 每个 tool 一个文件，路径 `mastra/tools/{name}.ts`
- 用 `zod` 定义 input/output schema
- tool 实现里**禁止再调 agent**（避免无限递归）
- tool 调 DB 必须通过 RequestContext 拿到 project_id 等 scope（见 §3.6）
- tool 永远是**只读或精确写**：禁止"看情况决定写什么"，那是 agent 的工作

```ts
// mastra/tools/search-bible.ts
import { createTool } from '@mastra/core'
import { z } from 'zod'

export const searchBible = createTool({
  id: 'search-bible',
  description: '在世界观 bible 中按语义搜索相关条目',
  inputSchema: z.object({
    query: z.string().describe('搜索关键词或描述'),
    kinds: z.array(z.enum(['location','item','concept','magic','faction'])).optional(),
    topK: z.number().default(5)
  }),
  outputSchema: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    kind: z.string()
  })),
  execute: async ({ context, input }) => {
    const projectId = context.requestContext.projectId
    return await bibleSearch(projectId, input.query, input.kinds, input.topK)
  }
})
```

### 3.3 Workflow

**Workflow = 多步骤、有分支和条件的流程编排**。

约定：

- 每个 workflow 一个文件，路径 `mastra/workflows/{name}.ts`
- 用 Mastra 的 `Workflow` builder 定义节点和边
- 节点要么是 agent 调用，要么是纯函数（数据变换、DB 写入）
- 不允许节点直接调 LLM；LLM 调用一律走 agent
- workflow 必须是**幂等的或可断点续跑的**（见 §19 可观测性）
- 状态通过 workflow 的 step output 传递，不依赖外部变量

```ts
// mastra/workflows/chapter-generation.ts
export const chapterGenerationWorkflow = createWorkflow({
  name: 'chapter-generation',
  triggerSchema: z.object({ chapterId: z.string() }),
  steps: [
    { name: 'load-context',  fn: loadChapterContext },
    { name: 'draft',         agent: chapterDraftAgent, stream: true },
    { name: 'save-draft',    fn: saveDraft },
    { name: 'summarize',     agent: chapterSummaryAgent },
    { name: 'extract-hook',  agent: hookAgent },
    { name: 'review',        parallel: reviewAgents },
    { name: 'auto-fix',      condition: hasCriticalIssues, fn: triggerAutoFix }
  ]
})
```

### 3.4 Memory

Mastra 的 Memory 系统有三层：**短期**（最近 N 条消息）、**长期**（observation + reflection）、**自定义 store**（任意 JSON）。

约定：

- 每个 agent 实例化时**显式声明** memory 配置，不依赖默认
- 长期记忆只对**生命周期长的 agent** 启用（角色 agent、director、读者模拟），不给 short-burst agent（章节生成、审稿）用
- **角色 agent 用 thread per character**：每个角色在每个项目里有自己的 thread id (`{projectId}:{characterId}`)，跨章节累积"经验"
- **章节级 agent 不用持久 memory**：每次调用都是新 thread，避免上下文跨章污染

```ts
import { Memory } from '@mastra/memory'

export const characterMemory = new Memory({
  storage: postgresStorage,
  vector: pgvectorStorage,
  embedder: bgeM3,
  options: {
    lastMessages: 20,           // 最近 20 条原始
    semanticRecall: { topK: 10 },  // 语义检索 10 条
    workingMemory: { enabled: true, template: characterWorkingMemoryTpl },
    observationalMemory: { enabled: true }  // Observer + Reflector 压缩历史
  }
})
```

### 3.5 Processor

**Processor = pre/post 消息钩子**。我们用它做：

- **预处理**：注入项目级别的不变上下文（voice 卡、genre profile）
- **后处理**：抽取 LLM 输出里的结构化数据（issue、bible facts）写回 DB
- **打 trace**：记录 input/output token、cost、duration 到 jobs 表

约定：

- 每个 agent 至少挂一个 trace processor
- 写作类 agent（draft、rewrite）挂一个 anti-slop pre-processor 注入黑名单
- 审稿 agent 挂一个 issue-extract post-processor 自动落库

### 3.6 Guardrail / RequestContext

- **Guardrail** 暂不强用——本系统单用户，没有 PII 风险，prompt injection 也来自自己。但留接口。
- **RequestContext** 必用，承载 `projectId / volumeId / chapterId / characterId / userId`。所有 tool 通过它拿 scope，禁止 hardcode。

```ts
// 进入 workflow 时设置
const ctx = createRequestContext({
  projectId: 'proj_xxx',
  volumeId: 'vol_xxx',
  chapterId: 'ch_xxx'
})
await workflow.run({ context: ctx, ...input })
```

---

## 4. 模块详细设计

### 4.1 Project 模块

**职责**：项目级元数据、文风、类型设置、全局开关。

**关键概念**：
- 一个 project 对应一本（系列）小说
- 跨卷不变：genre、voice、作者偏好、模型路由配置
- 卷级可变：thesis、arc、人物表（partial）

**核心数据**：
```
projects (
  id, title, genre,
  genre_config jsonb,         // genre profile 的可变部分
  voice_md text,              // 项目主声音卡（叙述者声音）
  author_notes text,          // 作者本人留给系统的指引
  model_routing jsonb,        // 哪个阶段用哪个模型
  safety_level enum,          // strict | normal | unrestricted
  created_at, updated_at
)

project_settings (
  project_id, key, value jsonb
  -- 比如 chapter_target_length=5000, default_pov='third_limited'
)
```

**关键操作**：
- 创建项目 → 触发 `ProjectBootstrapWorkflow`（见 §9.1）
- 编辑 voice → 触发声音卡同步到所有相关 prompt 缓存
- 切换 safety level → 切换 fallback 链

### 4.2 World 模块（Bible）

**职责**：硬性事实、世界观条目、势力、地理、物品、规则。

**关键概念**：
- **canon_facts**：不可违反的硬事实，如"主角 18 岁"。带 `immutable` 标志。
- **world_entries**：可演化的世界条目，如"长安城"、"无相剑诀"。带 embedding 用于 RAG。
- **factions**：势力关系矩阵（敌对、同盟、中立）。
- **timeline_events**：时间线大事件，世界级 vs 章节级。

**核心数据**：
```
canon_facts (
  id, project_id, fact text, category,
  source_chapter_id, immutable bool,
  created_at
)

world_entries (
  id, project_id, kind enum,        // location|item|concept|magic|faction|rule
  name, description, rules,
  parent_id,                          // 层级（地名套地名）
  embedding vector(1024),
  appearance_count int,
  first_appearance_chapter_id
)

factions (
  id, project_id, name, ideology,
  power_level int,
  embedding vector(1024)
)

faction_relations (
  faction_a, faction_b,
  relation enum,                      // ally|enemy|neutral|tense|trade
  notes text,
  changed_in_chapter_id
)

timeline_events (
  id, project_id, world_year,         // 世界内时间
  story_chapter_id,                   // 在哪一章被叙述
  event_text,
  participants jsonb                  // [character_ids, faction_ids]
)
```

**关键操作**：
- **抽取 canon**：每章 finalize 后跑 `BibleExtractAgent`，扫文本提硬事实
- **演化 world entry**：当一个条目在新章节里出现新细节，由 agent 提议追加描述（用户确认）
- **关系矩阵更新**：推演中或章节中检测到关系变化，issue 出来让用户确认更新

### 4.3 Character 模块

最复杂的模块，因为要做"知识不对称"。

**关键概念**：

- **三级人物**：
  - `principal`（5-10 个）：完整档案，知识状态，秘密动机
  - `recurring`（10-30 个）：基础档案，简化知识状态
  - `walk_on`：仅名字 + 一行描述，不持久化知识
- **公开 vs 私密**字段：
  - 公开（其他角色 agent 在推演时能看到）：name、appearance、public_role、observable_behavior_history
  - 私密（仅本角色 agent 自己 + 用户能看到）：secret_motive、true_intent、内心独白历史
- **知识状态**三类：
  - `knowledge_facts`：确定知道的事
  - `knowledge_suspected`：怀疑但没证实
  - `knowledge_lies`：被欺骗后相信的错误"事实"

**核心数据**：
```
characters (
  id, project_id, name,
  tier enum (principal|recurring|walk_on),
  
  -- 公开
  appearance text,
  public_role text,
  voice_md text,
  voice_samples text[],              // few-shot 样本
  embedding vector(1024),
  
  -- 私密
  secret_motive text,
  true_intent text,
  
  -- 弧
  arc_goal text,                     // "怯懦 → 果敢"
  arc_position int,                  // 0-100 当前进度
  arc_milestones jsonb,              // [{position, achieved_in_chapter}]
  
  -- 状态（动态变化）
  current_emotional_state text,
  current_location_id,
  alive bool default true,
  
  -- 元数据
  appearance_count int,
  first_appearance_chapter_id,
  last_appearance_chapter_id,
  promoted_at timestamp,             // 升级时间
  
  created_at, updated_at
)

character_knowledge (
  id, character_id,
  category enum (fact|suspected|lie),
  content text,
  source_chapter_id,
  source_event text,                 // "在第 7 章见证 X"
  certainty int,                     // 0-100
  created_at
)

character_relationships (
  id, character_a, character_b,
  relation_type enum,                // family|romantic|hostile|mentor|...
  warmth int,                        // -100..100
  trust int,                         // 0..100
  history_md text,                   // 关系演变叙述
  last_updated_chapter_id
)

character_appearances (
  id, character_id, chapter_id,
  significance int,                  // 0=路过 1=有台词 2=有动作 3=推动剧情
  pov bool,                          // 这章是否以该角色为 POV
  scene_count int
)

character_voice_anchors (
  id, character_id, sample_text,     // 用户挑选的精准样本
  context text,                      // 这段在何场景说的
  is_canonical bool                  // 必须以此为标杆
)
```

**关键操作**：
- **升级建议**：当 walk-on 出场 ≥2 次，issue 队列里加一条"建议升级"
- **知识 diff**：推演结束后由 `KnowledgeDiffAgent` 跑（见 §9.3）
- **关系演化**：用户标记某章为"关系转折点"时，触发关系更新 dialog
- **声音漂移检测**：每 5 章跑一次 `VoiceDriftReviewer`，对比角色最近台词与 voice_anchors

### 4.4 Outline 模块

**职责**：从命题到场景的层级化大纲。

**层级**：
```
project (无全书命题，按你确认的)
  └─ volume (有卷命题)
       └─ chapter_outline
            └─ scene_marker
                 └─ optional: simulation_anchor
```

**核心数据**：
```
volumes (
  id, project_id, volume_num, title,
  thesis text,                       // 卷命题
  arc_beats jsonb,                   // [{act, beat_name, target_chapter}]
  reader_promise text,               // 这卷给读者的承诺
  status enum (planning|writing|reviewing|done),
  created_at, finalized_at
)

chapter_outlines (
  id, volume_id, chapter_num, title,
  beats_md text,                     // 章节细纲（markdown）
  target_word_count int,
  pov_character_id,
  primary_location_id,
  characters_present jsonb,          // [character_ids]
  delivers_arc_beats jsonb,          // 推进哪些 arc beats
  hook_intent text,                  // 章末钩子意图
  status enum (outline|drafting|drafted|reviewed|finalized|locked),
  created_at
)

scene_markers (
  id, chapter_outline_id, order int,
  scene_type enum (dialogue|action|description|montage|interlude|simulation),
  goal text,                         // 这场戏要达成什么
  pov_character_id,
  characters_present jsonb,
  estimated_words int,
  is_simulation_candidate bool       // 是否值得用推演
)
```

**关键操作**：
- 卷创建 → `VolumeOutlineAgent` 提议命题 → 用户选 → 自动展开章节细纲
- 章节细纲 → `ChapterOutlineAgent` 拆 scene markers
- "这场要不要推演"由用户决定，`is_simulation_candidate` 是 AI 的建议

### 4.5 Generation 模块

**职责**：把 chapter_outline 变成 chapter draft，然后是 final。

**关键概念**：
- **draft** 与 **final** 分离：draft 是 AI 写的，final 是用户/AI 协作后定稿的
- **多版本**：每次重新生成、每次重写都新建 chapter_version
- **active_version_id** 指向当前活跃版本

**核心数据**：
```
chapters (
  id, chapter_outline_id, chapter_num,
  title, status,
  active_version_id,
  finalized_at, finalized_word_count
)

chapter_versions (
  id, chapter_id, version_label,
  content_md text,                   // 实际章节内容
  source enum (initial|rewrite|simulation_inserted|manual|merge),
  parent_version_id,                 // 树形结构
  diff_from_parent text,             // 与 parent 的 diff
  created_at, created_by
)

chapter_summaries (
  id, chapter_id, version_id,
  short_summary text,                // 200 字给下章用
  long_summary text,                 // 1000 字给卷审用
  emotional_arc text,                // 本章情感曲线
  key_events jsonb,                  // [{event, importance}]
  reader_questions_raised text[],    // 留给读者的悬念
  reader_questions_answered text[]   // 解答的悬念
)

chapter_chunks (                      // RAG 索引
  id, chapter_id, chunk_text, chunk_idx,
  pov_character_id,
  embedding vector(1024)
)
```

**关键操作**：
- 章节生成（核心流程，§9.2）
- 段落级局部重写（用户选段 → SectionRewriter agent）
- 切换活跃版本（branching）
- 强制重新生成摘要（当 final_md 改动）

### 4.6 Simulation 模块（多 agent 推演）

**职责**：在用户触发的场景上，用多 agent 角色扮演产生剧本草稿，再叙述化为小说文本。

**关键概念**：
- **推演只在用户点按钮时启动**（§9.3）
- 推演产物有两份：**剧本草稿**（保留为永久素材） + **叙述化文本**（注入章节）
- 剧本会被向量化索引，未来该角色出场时检索为 few-shot

**核心数据**：
```
simulations (
  id, scene_marker_id,
  status enum (estimating|running|paused|done|failed|cancelled),
  estimated_cost_usd numeric,
  actual_cost_usd numeric,
  estimated_duration_sec int,
  actual_duration_sec int,
  characters_involved jsonb,         // [character_ids with roles]
  director_goal text,
  director_constraints jsonb,        // [事件注入预案]
  pov_choice text,
  starting_world_state jsonb,
  ending_world_state jsonb,
  created_at, started_at, ended_at
)

simulation_turns (
  id, simulation_id, turn_idx,
  speaker_type enum (director|character|narrator|injection),
  speaker_id,                        // character_id 或 'director'/'narrator'
  utterance text,                    // agent 说的话
  reasoning text,                    // agent 的内心 OS（思考链）
  visible_to jsonb,                  // [character_ids]，知识隔离
  created_at
)

simulation_scripts (
  id, simulation_id,
  script_md text,                    // 整理后的剧本草稿
  raw_turns jsonb,                   // 完整原始 turn 数据
  embedding vector(1024),            // 剧本整体 embedding
  turn_count int
)

script_character_chunks (             // 按角色切片，方便未来检索
  id, simulation_script_id, character_id,
  chunk_text,                        // 该角色在此剧本的所有言行
  embedding vector(1024)
)

simulation_character_states (
  id, simulation_id, character_id,
  pre_knowledge_snapshot jsonb,
  post_knowledge_snapshot jsonb,
  knowledge_delta jsonb,             // [{op:'add', category:'suspected', content:'...'}]
  pre_emotional_state text,
  post_emotional_state text,
  pre_relationships jsonb,
  post_relationships jsonb
)
```

**关键操作**：
- 启动推演 → `SimulationWorkflow`（§9.3）
- 用户中途暂停 → 持久化 turns，下次可恢复
- 用户中途强制注入指令 → 写入 `simulation_turns` (type=injection)
- 推演完成 → 触发 `KnowledgeDiffAgent` 和 `Narrator` workflow

### 4.7 Review 模块

**职责**：审稿团检查质量，issue 队列管理待办。

**两类 issue**：
- `auto_fixable`：硬错（canon 矛盾、AI 味词、拼写）→ 自动修，记录日志
- `escalated`：软批评（节奏、主题、动机）→ 进 issue 队列等用户处理

**核心数据**：
```
issues (
  id, project_id,
  scope enum (paragraph|scene|chapter|volume|book|character|world),
  scope_id,                          // 多态 FK
  axis enum (logic|voice|canon|pacing|theme|genre|reader|aislop|character_promotion|relationship|continuity),
  severity enum (critical|warning|info),
  title text,
  description text,
  evidence text,                     // 引用的具体段落
  proposed_fix text,
  proposed_fix_diff text,
  status enum (open|in_progress|resolved|dismissed|auto_fixed|wont_fix),
  reviewer_agent text,
  related_issue_ids text[],          // 同源 issue 聚合
  created_at, resolved_at, dismissed_reason
)

review_runs (
  id, scope, scope_id,
  reviewers_invoked text[],          // 哪些 reviewer 跑了
  total_issues_found int,
  total_critical int,
  duration_ms int,
  cost_usd numeric,
  triggered_by enum (auto|manual|cron),
  created_at
)

fix_attempts (
  id, issue_id,
  attempt_idx int,                   // 1, 2 ...
  fix_agent text,
  before_text text,
  after_text text,
  diff_md text,
  outcome enum (succeeded|failed|introduced_new_issue),
  cost_usd numeric,
  created_at
)
```

**关键操作**：
- 章节 finalize → 自动触发 `ReviewWorkflow`
- 用户在 issue 上点"采纳建议" → 触发 `SectionRewriter`
- 用户点"忽略" → status = dismissed，记录 reason
- 自动修两次失败 → escalate 升级到 warning，等用户

### 4.8 Style 模块

**职责**：保持文风一致，消灭 AI 味。

**机制**：
- **voice 卡**：项目级、角色级，注入到对应 prompt
- **slop 黑名单**：可配置词典 + 模式（"她的眼中闪烁着..."）
- **style fingerprint**：统计章节的句长方差、词频、修辞密度，用于漂移检测

**核心数据**：
```
voice_cards (
  id, project_id,
  scope enum (project|character|narrator),
  scope_id,
  card_md text,                      // 提炼出的声音描述
  positive_samples text[],           // 这样写是对的
  negative_samples text[],           // 不要这样写
  do_use_words text[],
  dont_use_words text[],
  preferred_sentence_length enum,    // short|medium|long|varied
  preferred_pov text,
  active_version int
)

slop_blacklist (
  id, project_id,
  pattern text,                      // 字符串或正则
  is_regex bool,
  category enum (cliche|ai_tell|over_explain|empty_emotion|repetition),
  replacement_strategy text,         // 让 LLM 怎么替换
  enabled bool,
  hit_count int
)

style_fingerprints (
  id, chapter_id, version_id,
  avg_sentence_length numeric,
  sentence_length_variance numeric,
  vocab_richness numeric,            // type-token ratio
  metaphor_density numeric,
  dialogue_ratio numeric,            // 对话 / 总文本
  repeated_phrases jsonb,            // 命中黑名单的次数
  computed_at
)

style_drift_alerts (
  id, project_id,
  detected_in_chapter_id,
  drift_axis text,                   // 比如 sentence_length_variance
  baseline_value numeric,
  current_value numeric,
  severity enum
)
```

**关键操作**：
- 章节 finalize 后自动算 fingerprint
- 每 5 章对比基线，漂移超阈值 → issue
- voice 卡更新 → 触发"是否要用新 voice 重写历史章节"提议

### 4.9 Memory 模块

利用 Mastra 的 Memory，但加自定义 store。

**四种记忆**：

| 类型 | 存储 | 用途 | 谁用 |
|---|---|---|---|
| Working Memory | Mastra 内置 | 单次会话的工作上下文 | 所有 agent |
| Recent Messages | Mastra 内置 + Postgres | 最近 N 条对话 | 长 thread agent |
| Observation | Mastra Observer/Reflector | 压缩历史观察 | 角色 agent、director |
| Episodic | 自定义 store | 角色"经历"的结构化记录 | 角色 agent |

```
character_episodic_memory (
  id, character_id,
  episode_type enum (conversation|action|witnessed|learned|felt),
  summary text,                      // "在长安城见到了王某并起疑"
  participants jsonb,
  emotional_valence int,             // -10..10
  importance int,                    // 0..10
  source_chapter_id,
  source_simulation_id,
  embedding vector(1024),
  created_at
)
```

**关键操作**：
- 章节 finalize → 抽取每个出场角色的 episodic memory
- 推演前 → 角色 agent 加载相关 episodic（按 importance + 相似度）
- 定期跑 reflection：把零散 episodic 合并成更高层"信念"（"我认为王某不可信"）

### 4.10 Time 模块（世界时钟）

**关键概念**：
- 世界时间在故事中流逝，但 AI 写作时容易"原地踏步"
- 用 world_clock 表强制时间推进
- 主角不在场的世界事件（反派宗门扩张、政变酝酿）由 `WorldTickAgent` 在章节间生成

**核心数据**：
```
world_clock (
  id, project_id,
  current_world_date text,           // "元和三年春"
  current_chapter_id,
  pace_config jsonb                  // {chapters_per_world_day: 0.5}
)

between_chapter_events (
  id, project_id, after_chapter_id,
  event_text,
  visibility enum (hidden|hinted|revealed),  // 读者是否知道
  visible_to_characters jsonb,
  triggers_in_chapter_id,            // 这事在哪章会显现
  created_by_agent text,
  acknowledged_by_user bool
)

faction_movements (                   // 势力的"暗线推进"
  id, faction_id, after_chapter_id,
  action text,
  target_faction_id,
  effect text
)
```

**关键操作**：
- 每章 finalize 后跑 `WorldTickAgent`：生成 0-3 个 between_chapter_event
- 这些事件在未来章节生成时作为"世界状态"注入 prompt
- 用户可以手动添加事件（钦定剧情）

### 4.11 Version 模块

**职责**：章节级别的 git，支持分支、回退、影响检测。

**关键概念**：
- 每次 generate / rewrite / manual edit 都生成新 version
- version 形成树：`parent_version_id`
- "active version" 是当前展示的版本
- 切换 active version 时，**检测下游章节的依赖**

**核心数据**（除 chapter_versions 外）：
```
version_dependencies (
  id, downstream_chapter_id,
  upstream_chapter_id, upstream_version_id,
  dependency_type enum (summary|character_state|canon|world_event),
  detected_at
)

version_branches (                    // 命名分支
  id, project_id, chapter_id,
  name text,                         // "线索 A 走向"
  head_version_id,
  description text,
  created_at
)
```

**关键操作**：
- 切换 active version → 比较两版的 summary diff、character_state diff
- 列出所有受影响的下游章节，标红
- 提供"自动重新生成下游"或"手动逐章确认"两种选项

### 4.12 Observability 模块

**职责**：每一次 LLM 调用、agent 执行、tool call 都留痕。

**核心数据**：
```
jobs (                                // workflow / 长任务
  id, project_id,
  type, status,
  workflow_name, workflow_run_id,
  input jsonb, output jsonb,
  parent_job_id,                     // 嵌套任务
  error_text,
  started_at, completed_at,
  total_cost_usd, total_tokens_in, total_tokens_out
)

llm_calls (                           // 每次实际 API 调用
  id, job_id,
  agent_name,
  provider, model,
  prompt_id, prompt_version,
  input_text text,
  input_tokens int,
  output_text text,
  output_tokens int,
  reasoning_text text,                // 思考链（如有）
  cost_usd numeric,
  duration_ms int,
  finish_reason text,                 // stop|length|content_filter
  created_at
)

tool_calls (
  id, job_id, agent_name,
  tool_name, input jsonb, output jsonb,
  duration_ms, error_text,
  created_at
)

agent_decisions (                     // 关键决策点
  id, job_id, agent_name,
  decision_type text,                // 比如 director 决定"注入事件"
  context_summary text,
  chosen_option text,
  alternatives_considered text[],
  rationale text
)
```

**关键操作**：
- 任何 workflow 启动 → 创建 root job
- 每个 step 创建 child job
- 每次 agent 调用 → llm_calls 记录
- UI 提供 "回放" 视图，按 job tree 展示
- 每月跑 cost summary，发邮件 / 写到看板

### 4.13 Export 模块

**职责**：把作品导出为可分发格式。

**支持格式**：
- 单一 markdown（最简）
- epub（需要工具，pandoc 或 epubgen）
- docx（pandoc）
- pdf（pandoc + LaTeX template）

**核心数据**：
```
exports (
  id, project_id,
  format enum (md|epub|docx|pdf),
  scope enum (chapter|volume|full),
  scope_id,
  config jsonb,                      // 字体、章节命名规则
  output_path text,
  status, error_text,
  created_at, completed_at
)
```

**关键操作**：
- 用户选范围 + 格式 → 创建 export job
- 后台跑 pandoc / 类似工具，输出到 `/exports/`

### 4.14 Prompt 模块

**职责**：所有 prompt 的版本控制、A/B 实验、回滚。

**关键概念**：
- prompt 文件在 `prompts/` 目录，markdown + frontmatter
- 每次启动时 sync 到 DB（DB 是真理来源）
- 每个 agent 在每次调用时记录用的 prompt_version
- 支持 A/B 实验：50% 用 v3，50% 用 v4，对比效果

**核心数据**：
```
prompts (
  id, name, version, scope enum (agent|tool|workflow),
  template_md text,
  frontmatter jsonb,
  required_vars text[],
  optional_vars text[],
  active bool,
  created_at,
  notes text                         // 这版改了什么
)

prompt_runs (
  id, prompt_id, version,
  job_id, agent_name,
  input_vars jsonb,
  rendered_text text,
  output_text text,
  rating int,                        // 用户事后评分（可选）
  rated_at
)

prompt_experiments (
  id, name,
  prompt_a_id, prompt_b_id,
  active bool,
  split_ratio numeric,               // 0.5 = 50/50
  metric text,                       // 比如 user_acceptance_rate
  winner text                        // 'a'|'b'|'tie'|'pending'
)
```

**关键操作**：
- 启动时 sync `prompts/` → DB
- agent 调用时按 active version 取，experiment 模式按 split 取
- UI 提供 prompt diff、prompt run 回放、用户评分

---

## 5. Agent 目录

完整 agent 清单。每条包含：用途、关键 tools、memory 配置、调用者。

### 5.1 Generation 类

#### 5.1.1 PremiseAgent
- **用途**：生成 N 个强制差异化的卷命题候选
- **Tools**：`getProjectGenre`, `getPreviousVolumeThemes`
- **Memory**：无（一次性）
- **调用者**：ProjectBootstrapWorkflow, VolumeStartWorkflow
- **Prompt 关键**：方差轴显式（道德 / 身份 / 体系 / 关系），3 个选项必须分别落在不同轴

#### 5.1.2 VolumeOutlineAgent
- **用途**：从命题展开三幕弧 + arc_beats
- **Tools**：`getGenreProfile`, `getCharacterRoster`
- **Memory**：无
- **调用者**：VolumeBootstrapWorkflow

#### 5.1.3 ChapterOutlineAgent
- **用途**：从卷弧拆 N 章细纲，每章带 scene markers
- **Tools**：`getVolumeArc`, `getCharacterRoster`, `getRecentChapterSummaries`
- **Memory**：无
- **调用者**：VolumeBootstrapWorkflow, ChapterPlanningWorkflow

#### 5.1.4 ChapterDraftAgent ⭐ 最高频
- **用途**：写章节初稿（流式）
- **Tools**：`searchBible`, `getCharacterProfile`, `getRecentSummaries`, `getRecentScripts`, `getActiveVoiceCard`, `getGenreProfile`, `getWorldClockState`, `getBetweenChapterEvents`
- **Memory**：无（每章独立）
- **调用者**：ChapterGenerationWorkflow
- **关键约束**：必须流式；必须遵守 voice 卡；必须避开黑名单

#### 5.1.5 ChapterSummaryAgent
- **用途**：章节 finalize 后生成 short + long summary + key events + reader questions
- **Tools**：无
- **Memory**：无
- **调用者**：ChapterGenerationWorkflow（末尾）

#### 5.1.6 HookAgent
- **用途**：检查章末，强化钩子
- **Tools**：`getNextChapterOutline`
- **Memory**：无
- **调用者**：ChapterGenerationWorkflow，或被 PacingReviewer 调用

#### 5.1.7 SectionRewriterAgent
- **用途**：用户选段后定向重写
- **Tools**：`searchBible`, `getCharacterProfile`, `getActiveVoiceCard`
- **Memory**：无
- **调用者**：用户 UI 直接调用，或 fix_attempt

### 5.2 World / Character 类

#### 5.2.1 BibleExtractAgent
- **用途**：扫已 finalize 的章节，提硬事实写回 canon_facts 和 world_entries
- **Tools**：`getChapterFinalText`, `proposeCanonFact`, `proposeWorldEntry`
- **Memory**：无
- **调用者**：ChapterGenerationWorkflow（末尾）

#### 5.2.2 CharacterProfileAgent
- **用途**：从用户输入或 bootstrap 时生成完整 principal 档案
- **Tools**：`getProjectGenre`, `getVolumeContext`, `getRelatedCharacters`
- **Memory**：无
- **调用者**：ProjectBootstrapWorkflow, CharacterCreateAction

#### 5.2.3 VoiceExtractAgent
- **用途**：给定多段角色台词样本，提炼出声音卡
- **Tools**：无
- **Memory**：无
- **调用者**：用户在角色页点"提炼声音"

#### 5.2.4 KnowledgeDiffAgent
- **用途**：推演结束后，对每个角色计算 knowledge delta
- **Tools**：`getCharacterPreSimulationState`, `proposeKnowledgeUpdate`
- **Memory**：无
- **调用者**：SimulationWorkflow（末尾）

#### 5.2.5 RelationshipUpdateAgent
- **用途**：检测推演 / 章节中的关系变化，提议关系矩阵更新
- **Tools**：`getCurrentRelationships`, `proposeRelationshipChange`
- **Memory**：无
- **调用者**：SimulationWorkflow, ChapterGenerationWorkflow（条件）

### 5.3 Simulation 类

#### 5.3.1 DirectorAgent ⭐ 推演核心
- **用途**：管理推演场景，决定何时注入事件、何时收场
- **Tools**：`getSceneGoal`, `injectEvent`, `endScene`, `getTurnHistory`
- **Memory**：working memory（场景目标、已发生事件清单）
- **调用者**：SimulationWorkflow

#### 5.3.2 CharacterAgent ⭐ 模板化
- **用途**：扮演单个角色，根据私密档案 + 公开认知做决策
- **Tools**：`searchOwnEpisodicMemory`, `getOwnKnowledge`, `getRelationshipsTo`, `getObservedBehavior`
- **Memory**：episodic + working memory（per character per project，长生命周期）
- **调用者**：SimulationWorkflow（每个参与角色实例化一份）
- **关键约束**：只能看自己的 secret_motive，对其他角色只能看 public_role 和 observable_behavior

#### 5.3.3 NarratorAgent
- **用途**：把推演的剧本草稿叙述化为小说文本
- **Tools**：`getActiveVoiceCard`, `getPOVCharacter`, `getGenreProfile`
- **Memory**：无
- **调用者**：SimulationWorkflow（末尾）

### 5.4 Review 类（8 个 reviewer + 自动修）

#### 5.4.1 LogicReviewer
- **用途**：因果检查、bug 检测
- **Tools**：`getCanonFacts`, `getRecentEvents`, `addIssue`
- **Memory**：无

#### 5.4.2 VoiceReviewer
- **用途**：每个角色台词与其 voice_card 一致性
- **Tools**：`getCharacterVoiceCard`, `getCharacterVoiceAnchors`, `addIssue`
- **Memory**：无

#### 5.4.3 CanonReviewer
- **用途**：与 canon_facts 矛盾检查
- **Tools**：`getCanonFacts`, `addIssue`
- **Memory**：无

#### 5.4.4 PacingReviewer
- **用途**：节奏分析、scene 长度合理性、信息密度
- **Tools**：`getChapterOutline`, `getStyleFingerprint`, `addIssue`
- **Memory**：无

#### 5.4.5 ThemeReviewer
- **用途**：本章对卷命题的贡献度
- **Tools**：`getVolumeThesis`, `getVolumeArcBeats`, `addIssue`
- **Memory**：无

#### 5.4.6 GenreReviewer
- **用途**：类型契约检查（仙侠该有突破、言情该有情感推进等）
- **Tools**：`getGenreProfile`, `getGenreContractRules`, `addIssue`
- **Memory**：无

#### 5.4.7 ReaderSimulator
- **用途**：模拟一个普通读者读完这章的反应
- **Tools**：`getReaderQuestionsRaised`, `getReaderQuestionsAnswered`, `addIssue`
- **Memory**：working memory（模拟读者的"已读知识"）

#### 5.4.8 SlopDetector
- **用途**：检测 AI 味、句长方差、重复模式
- **Tools**：`getSlopBlacklist`, `getStyleFingerprint`, `getProjectBaseline`, `addIssue`
- **Memory**：无

#### 5.4.9 SlopFixer（自动修）
- **用途**：替换黑名单词、调整重复结构
- **Tools**：`getSlopBlacklist`, `applySectionRewrite`
- **Memory**：无

#### 5.4.10 CanonFixer（自动修）
- **用途**：修正与 canon 矛盾的局部段落
- **Tools**：`getCanonFacts`, `applySectionRewrite`
- **Memory**：无

#### 5.4.11 VolumeReviewer
- **用途**：卷级综合审稿（三幕完整性、人物弧达成度）
- **Tools**：`getVolumeArc`, `getAllChapterSummaries`, `getCharacterArcProgress`, `addIssue`
- **Memory**：无

### 5.5 Time / Memory 类

#### 5.5.1 WorldTickAgent
- **用途**：在两章之间推进世界状态
- **Tools**：`getWorldClock`, `getFactionMovements`, `proposeWorldEvent`
- **Memory**：无

#### 5.5.2 ObservationCompressor（基于 Mastra Observer）
- **用途**：压缩长 thread memory 到 observation
- **Memory**：管理 character agent 的长期记忆

#### 5.5.3 ReflectionAgent（基于 Mastra Reflector）
- **用途**：把多个 observation 提炼成更高层 belief
- **Memory**：同上

### 5.6 Cost / Routing 类

#### 5.6.1 CostEstimatorAgent
- **用途**：在用户触发推演前预估 token 和耗时
- **Tools**：`getCharacterCount`, `getEstimatedTurns`, `getModelPricing`
- **Memory**：无
- **调用者**：UI（推演按钮 popup）

#### 5.6.2 ContentSafetyRouterAgent
- **用途**：检测当前段落是否触及商用模型审查线，路由到合适 provider
- **Tools**：`scanForSensitiveContent`, `getProviderRoutes`
- **Memory**：无
- **调用者**：每次 LLM 调用前的 pre-processor

---

## 6. Tool 目录

### 6.1 Bible / World

- `searchBible(query, kinds?, topK)` → entries[]
- `getCanonFacts(category?)` → facts[]
- `getCanonByChapter(chapterId)` → facts[]
- `proposeCanonFact(fact, category)` → issueId
- `proposeWorldEntry(name, kind, description)` → issueId
- `getFactionRelations()` → matrix
- `proposeFactionChange(from, to, change)` → issueId

### 6.2 Character

- `getCharacterProfile(id, viewerCharacterId?)` → profile（带 privacy filter）
- `getCharacterRoster(tier?)` → list
- `getCharacterKnowledge(characterId)` → facts/suspected/lies
- `searchOwnEpisodicMemory(characterId, query, topK)` → memories[]
- `searchPreviousScripts(characterId, query, topK)` → script chunks[]
- `getRelationshipsTo(characterAId, characterBId?)` → relationships
- `getObservedBehavior(byCharacterId, ofCharacterId)` → 观察记录
- `getCharacterVoiceCard(characterId)` → card
- `getCharacterVoiceAnchors(characterId)` → samples[]
- `proposeKnowledgeUpdate(characterId, delta)` → issueId or auto-applied
- `proposeRelationshipChange(...)` → 同上

### 6.3 Outline / Generation

- `getVolumeArc(volumeId)` → arc + beats
- `getChapterOutline(chapterId)` → outline + scene markers
- `getNextChapterOutline(currentChapterId)` → next outline
- `getRecentSummaries(currentChapterId, n=3)` → summaries[]
- `getRecentScripts(involvingCharacterIds, topK)` → scripts[]

### 6.4 Style / Voice

- `getActiveVoiceCard(scope, scopeId)` → card
- `getProjectVoiceMd()` → text
- `getGenreProfile(genre)` → profile
- `getSlopBlacklist(active=true)` → patterns[]
- `getStyleFingerprint(chapterId)` → metrics

### 6.5 Time / World Clock

- `getWorldClockState()` → current
- `getBetweenChapterEvents(beforeChapterId, includeHidden=false)` → events
- `proposeWorldEvent(...)` → eventId

### 6.6 Issue / Review

- `addIssue(scope, scopeId, axis, severity, description, evidence, proposedFix?)` → issueId
- `applySectionRewrite(chapterId, before, after, reason)` → newVersionId
- `endScene(simulationId, reason)` → 标记结束
- `injectEvent(simulationId, eventText)` → turnId

### 6.7 Cost / Routing

- `getModelPricing(provider, model)` → prices
- `getProviderRoutes(currentTask)` → ordered list

---

## 7. Workflow 目录

### 7.1 ProjectBootstrapWorkflow
1. 用户提供：种子 + genre
2. PremiseAgent 出 3 个候选
3. UI 让用户选 / regenerate
4. VolumeOutlineAgent 出卷一弧
5. CharacterProfileAgent 出 3-5 个 principal
6. ChapterOutlineAgent 出卷一前 N 章细纲
7. 写入数据库，跳到主写作 UI

### 7.2 ChapterGenerationWorkflow ⭐ 最高频
（详见 §9.2）

### 7.3 SimulationWorkflow ⭐
（详见 §9.3）

### 7.4 ReviewWorkflow
1. 输入：scope (chapter|volume) + scopeId
2. 并发跑所有适用 reviewer
3. 收集 issues
4. 检测 critical 是否需要 auto-fix
5. 跑 auto-fix（最多 2 次）
6. 写入 review_run 总结

### 7.5 RewriteWorkflow
1. 输入：chapterId + range + reason
2. 加载上下文（bible、voice、上下文段落）
3. SectionRewriter 跑
4. 写入新 version
5. 如改动很大，触发 ReviewWorkflow

### 7.6 VolumeFinalizationWorkflow
1. 检测所有章节是否 finalized
2. VolumeReviewer 跑
3. 如通过，volume.status = done
4. 触发"是否开始下一卷"提议

### 7.7 WorldTickWorkflow
1. 章节 finalize 后触发
2. WorldTickAgent 跑
3. 写入 between_chapter_events 和 faction_movements

### 7.8 BibleExtractionWorkflow
1. 章节 finalize 后触发
2. BibleExtractAgent 扫文本
3. 提议条目入 issue 队列等用户确认（principal 类）或 auto-add（明显的 walk-on）

### 7.9 ExportWorkflow
1. 用户选范围 + 格式
2. 拼装内容
3. 调 pandoc / 自定义 epub generator
4. 写入 exports 表，UI 出现下载链接

### 7.10 RegenerationCascadeWorkflow（branching 切换时）
1. 用户切换 chapter 5 的 active version
2. 检测下游受影响章节（基于 version_dependencies）
3. UI 列出受影响章节
4. 用户选"自动重生"或"手动逐章确认"
5. 如自动，依次跑 ChapterGenerationWorkflow

---

## 8. 数据库 schema（完整）

按模块归类。所有表都加 `created_at`、必要时 `updated_at`，外键 ON DELETE CASCADE 视情况。

（前面各模块已展开，此处仅汇总表名清单 + 核心索引）

```
projects, project_settings
volumes, chapter_outlines, scene_markers
chapters, chapter_versions, chapter_summaries, chapter_chunks
canon_facts, world_entries, factions, faction_relations, timeline_events
characters, character_knowledge, character_relationships, character_appearances, character_voice_anchors
character_episodic_memory
simulations, simulation_turns, simulation_scripts, script_character_chunks, simulation_character_states
issues, review_runs, fix_attempts
voice_cards, slop_blacklist, style_fingerprints, style_drift_alerts
world_clock, between_chapter_events, faction_movements
version_dependencies, version_branches
jobs, llm_calls, tool_calls, agent_decisions
exports
prompts, prompt_runs, prompt_experiments

-- Mastra 自带（不需自己建）
mastra_threads, mastra_messages, mastra_observations, mastra_workflow_runs
```

**关键索引**：
- 所有 vector 字段建 ivfflat 索引（pgvector）
- `issues.status` 部分索引 (where status='open')
- `chapters.active_version_id`、`chapter_outlines.volume_id`
- `character_appearances.character_id, chapter_id` 联合
- `simulation_turns.simulation_id, turn_idx` 联合

---

## 9. 关键流程详解

### 9.1 项目启动流程

```
[UI] 用户填写：标题 + 种子 + 类型 (genre)
   ↓
[Workflow] ProjectBootstrapWorkflow
   ├─ Step 1: 创建 project 行
   ├─ Step 2: PremiseAgent 跑（流式输出 3 候选）
   │   ↓ 用户选 1 个
   ├─ Step 3: VolumeOutlineAgent 跑（流式）
   │   ↓ 用户确认
   ├─ Step 4: CharacterProfileAgent 跑 N 次（每个 principal 一次）
   │   ↓ 用户编辑 / 确认
   ├─ Step 5: ChapterOutlineAgent 跑（前 N 章）
   │   ↓ 用户确认
   ├─ Step 6: 写入 volumes + chapter_outlines + characters
   └─ 跳转到主写作 UI
```

### 9.2 章节生成流程 ⭐ 最高频

```
[UI] 用户在第 N 章点"生成"
   ↓
[API] POST /api/chapters/{id}/generate
   ↓
[Workflow] ChapterGenerationWorkflow start
   │
   ├─ Step 1: load-context
   │   ├─ tool: getChapterOutline
   │   ├─ tool: getRecentSummaries (last 3)
   │   ├─ tool: searchBible (relevant to outline)
   │   ├─ tool: getCharacterProfile (for each in characters_present)
   │   ├─ tool: getActiveVoiceCard (project)
   │   ├─ tool: getGenreProfile
   │   ├─ tool: getWorldClockState
   │   └─ tool: getBetweenChapterEvents (after prev chapter)
   │
   ├─ Step 2: draft (STREAMING)
   │   ├─ ChapterDraftAgent 拿到全部上下文
   │   ├─ pre-processor: 注入 voice 卡 + slop 黑名单
   │   ├─ 流式输出 → SSE → UI Tiptap 实时显示
   │   └─ 完成时 post-processor: 写入新 chapter_version (source=initial)
   │
   ├─ Step 3: summarize
   │   └─ ChapterSummaryAgent 跑，写入 chapter_summaries
   │
   ├─ Step 4: extract-hook
   │   ├─ 检查章末 200 字
   │   └─ 如钩子弱，HookAgent 重写最后段
   │
   ├─ Step 5: chunk-and-embed
   │   └─ 切 chunks，embed，写入 chapter_chunks
   │
   ├─ Step 6: review (并发)
   │   └─ ReviewWorkflow 异步触发，不阻塞
   │
   ├─ Step 7: bible-extract (异步)
   │   └─ BibleExtractionWorkflow
   │
   └─ Step 8: world-tick (异步)
       └─ WorldTickWorkflow

[UI] 流式期间用户陪着看，结束后 issues 面板出现红点
```

### 9.3 推演流程 ⭐ 最复杂

```
[UI] 用户在某 scene_marker 点"推演"
   ↓
[Modal] 显示参与角色（自动检测 + 手动添加）
        让用户写 director_goal
        让用户选 POV
   ↓
[API] CostEstimatorAgent 跑预估
   ↓
[Modal] 显示 "约 $0.32 / 6 分钟"，确认开始
   ↓
[Workflow] SimulationWorkflow start
   │
   ├─ Step 1: setup
   │   ├─ 创建 simulation 行
   │   ├─ 为每个参与角色快照当前 character_knowledge → simulation_character_states.pre_*
   │   ├─ 实例化 N 个 CharacterAgent（每个有自己的 thread_id）
   │   └─ 实例化 1 个 DirectorAgent
   │
   ├─ Step 2: simulation loop（最多 50 turns）
   │   │
   │   ├─ Director 决定：
   │   │   ├─ 让谁说？（基于场景动态）
   │   │   ├─ 是否注入事件？
   │   │   └─ 是否结束？
   │   │
   │   ├─ 如选了一个 character：
   │   │   ├─ CharacterAgent 拿到的上下文：
   │   │   │   - 自己完整档案（含 secret_motive）
   │   │   │   - 自己 episodic memory（topK 相关）
   │   │   │   - 其他角色的"公开"信息（observable_behavior）
   │   │   │   - 截至当前的 turns（visible_to 包含自己）
   │   │   ├─ 流式输出 utterance + reasoning
   │   │   └─ 写入 simulation_turns，broadcast 到 SSE
   │   │
   │   ├─ 如选了"注入事件"：
   │   │   └─ Director 写入 simulation_turns (type=injection)，所有角色可见
   │   │
   │   └─ 如选了"结束"：跳出循环
   │
   ├─ Step 3: knowledge-diff
   │   └─ KnowledgeDiffAgent 对每个参与角色：
   │       ├─ 输入：pre_knowledge + 完整 turn history
   │       ├─ 输出：[{op, category, content, certainty}]
   │       └─ 写入 simulation_character_states.knowledge_delta
   │           + 同步更新 characters.knowledge_*
   │
   ├─ Step 4: relationship-update
   │   └─ RelationshipUpdateAgent 检测关系变化
   │
   ├─ Step 5: script-finalize
   │   ├─ 把 turns 整理成 script_md
   │   ├─ 整体 + 按角色切片 embed
   │   └─ 写入 simulation_scripts + script_character_chunks
   │
   ├─ Step 6: scenify (NarratorAgent)
   │   ├─ 输入：script_md + POV + voice_card + genre_profile
   │   ├─ 流式输出小说体段落
   │   └─ 用户决定是否注入到对应章节
   │
   └─ Step 7: episodic memory update
       └─ 为每个参与角色生成 episodic_memory 条目

[UI] 推演面板展示分气泡的 turn 流，用户可暂停 / 干预 / 终止
```

### 9.4 卷收尾流程

```
[Trigger] 用户在卷视图点"卷已完结"
   ↓
[Workflow] VolumeFinalizationWorkflow
   ├─ 检查所有章节 finalized
   ├─ VolumeReviewer 跑（综合三幕、人物弧、卷命题达成）
   ├─ 如有 critical issues → 暂不能 finalize，提示
   ├─ 如通过：
   │   ├─ volume.status = done, finalized_at = now
   │   ├─ 触发卷级 export（自动出 epub 备份）
   │   └─ 提议"开始下一卷"对话
   └─ 写入 review_run
```

### 9.5 重写流程

```
[UI] 用户在某段文本上选中 → 右键 → "用 AI 重写"
   ↓
[Modal] 让用户写 reason（可选）
   ↓
[Workflow] RewriteWorkflow
   ├─ 加载段落上下文（前后各 500 字 + 章节 outline）
   ├─ SectionRewriterAgent 跑（流式）
   ├─ UI 显示 diff，用户接受 / 拒绝 / 再来一次
   ├─ 接受 → 应用 patch，新建 chapter_version (source=rewrite)
   └─ 如改动 ≥30%，触发 ReviewWorkflow 重审
```

---

## 10. Prompt 库结构

```
prompts/
├── _shared/                          # 跨 prompt 复用片段
│   ├── voice_injection.md
│   ├── safety_framing.md
│   └── output_format_xml.md
│
├── agents/
│   ├── premise.md
│   ├── volume_outline.md
│   ├── chapter_outline.md
│   ├── chapter_draft.md
│   ├── chapter_summary.md
│   ├── hook.md
│   ├── section_rewriter.md
│   │
│   ├── bible_extract.md
│   ├── character_profile.md
│   ├── voice_extract.md
│   ├── knowledge_diff.md
│   ├── relationship_update.md
│   │
│   ├── director.md
│   ├── character_agent_template.md   # 角色 agent 通用模板
│   ├── narrator.md
│   │
│   ├── reviewer/
│   │   ├── logic.md
│   │   ├── voice.md
│   │   ├── canon.md
│   │   ├── pacing.md
│   │   ├── theme.md
│   │   ├── genre.md
│   │   ├── reader.md
│   │   ├── slop.md
│   │   └── volume.md
│   │
│   ├── fixer/
│   │   ├── slop.md
│   │   └── canon.md
│   │
│   ├── world_tick.md
│   ├── observation_compressor.md
│   ├── reflection.md
│   ├── cost_estimator.md
│   └── content_safety_router.md
│
├── genre_profiles/
│   ├── universal.json
│   ├── xianxia.json
│   ├── scifi.json
│   ├── romance.json
│   ├── literary.json
│   ├── mystery.json
│   └── horror.json
│
└── slop_dictionaries/
    ├── chinese_general.json          # 通用中文 AI 味词典
    ├── chinese_xianxia.json          # 仙侠特化
    └── english_general.json
```

每个 agent prompt 的 frontmatter 模板：

```yaml
---
name: chapter_draft
version: 1
description: 流式生成章节初稿
model_preference: deepseek-v3.2-chat
temperature: 0.85
max_tokens: 12000
required_vars:
  - chapter_outline
  - voice_card
  - genre_profile
  - bible_extract
  - prev_chapter_summary
  - characters_present
optional_vars:
  - between_chapter_events
  - world_clock_state
  - user_notes
output_format: markdown
streaming: true
---

# Instructions

You are ...
```

---

## 11. UI 结构与导航

```
/                                    # 项目列表
/projects/new                        # 创建项目
/projects/[id]                       # 项目主面板
├── /overview                        # 项目总览
├── /volumes                         # 卷列表
│   └── /[volId]                     # 卷详情（弧、章节列表）
├── /chapters/[chId]                 # 章节编辑器（核心页面）
│   ├── 顶栏: 章节切换 / 版本切换 / 设置
│   ├── 左侧: 章节细纲 + scene markers
│   ├── 中间: Tiptap 编辑器
│   ├── 右侧: bible / character / issue 三 tab
│   └── 底栏: 流式生成进度 / 操作按钮
├── /characters                      # 角色管理
│   ├── 三 tab: principal / recurring / walk_on
│   └── 升级建议 badge
├── /bible                           # 世界观管理
│   ├── canon facts
│   ├── world entries
│   ├── factions + 关系矩阵
│   └── timeline
├── /simulations                     # 推演历史
├── /issues                          # issue 中心（GitHub 风格）
├── /style                           # 文风管理
│   ├── voice cards
│   ├── slop blacklist
│   └── drift dashboard
├── /observability                   # trace、cost、prompt runs
├── /prompts                         # prompt 库管理（开发者视图）
├── /exports                         # 导出
└── /settings                        # 项目设置
```

**全局组件**：
- 顶部 token 用量条（本月已用 / 预算）
- 右上 issue 红点
- 右下浮动"AI 思考中..."状态

---

## 12. API 表面

REST + Server Actions 混用。规则：

- 流式：必须用 Route Handler（SSE）
- 写操作：优先 Server Actions
- 读操作：直接 React Server Components 拿数据，不暴露 API

**主要端点**：

```
POST   /api/projects                          创建项目（启动 ProjectBootstrap）
POST   /api/chapters/[id]/generate            生成章节（SSE）
POST   /api/chapters/[id]/rewrite             段落重写（SSE）
POST   /api/simulations                       启动推演（SSE）
POST   /api/simulations/[id]/inject           推演中注入事件
POST   /api/simulations/[id]/pause
POST   /api/simulations/[id]/resume
POST   /api/simulations/[id]/end
POST   /api/issues/[id]/apply-fix             采纳 issue 建议
POST   /api/issues/[id]/dismiss
POST   /api/exports                           创建导出任务
GET    /api/jobs/[id]                         job 状态轮询
GET    /api/jobs/[id]/trace                   完整 trace
GET    /api/prompts                           prompt 列表
PUT    /api/prompts/[id]                      更新 prompt（创建新 version）
```

---

## 13. 流式架构

### 13.1 单 agent 流式（章节生成）

```
Browser (EventSource)
   ↓
GET /api/chapters/[id]/generate
   (Edge runtime, returns ReadableStream)
   ↓
mastra workflow.run({ stream: true })
   ↓
agent.stream() (yields token deltas)
   ↓
SSE events: 'token' | 'tool_call' | 'tool_result' | 'done' | 'error'
   ↓
Browser pipes into Tiptap doc
```

事件格式：
```ts
interface SSEEvent {
  type: 'token' | 'tool_call' | 'tool_result' | 'done' | 'error' | 'meta'
  data: any
  jobId: string
  timestamp: number
}
```

### 13.2 多 agent 流式（推演）

```
Browser (EventSource)
   ↓
GET /api/simulations/[id]/stream
   ↓
SimulationWorkflow（已在跑）
   ↓
每个 agent turn 发一组 events:
   - 'turn_start' { speaker_id }
   - 'token' { delta, channel: 'utterance'|'reasoning' }
   - 'turn_end' { turnId, full_text }
   ↓
Browser 按 channel 分气泡渲染
```

### 13.3 取消机制

- 用户关闭 tab 或点"停止" → AbortSignal 传到 workflow → workflow 中止 LLM 调用 → 已生成内容仍保存（不浪费）

### 13.4 并发

- 同一项目允许同时跑：1 个章节生成 + 1 个推演 + N 个后台审查
- Postgres advisory lock 保护 chapter 行级别的并发写

---

## 14. 记忆系统（详细）

### 14.1 四层记忆的 lifecycle

```
                         [原始 turn]
                              │
                              ▼
              ┌────────────────────────────┐
              │   Mastra Recent Messages   │  ← 最近 20 条原始
              └────────────────────────────┘
                              │
                  超过窗口    ▼
              ┌────────────────────────────┐
              │   Observer 压缩              │
              │   → "李某和王某的对峙"        │
              └────────────────────────────┘
                              │
                              ▼
              ┌────────────────────────────┐
              │   Observation 表（带向量）   │  ← 语义检索
              └────────────────────────────┘
                              │
                  累积多个    ▼
              ┌────────────────────────────┐
              │   Reflector 提炼             │
              │   → "我开始怀疑王某"         │
              └────────────────────────────┘
                              │
                              ▼
              ┌────────────────────────────┐
              │   Belief / Reflection 表    │
              └────────────────────────────┘

并行：
              ┌────────────────────────────┐
              │   Episodic Memory          │  ← 章节 finalize 时显式抽取
              │   "在第 7 章我做了 X"       │
              └────────────────────────────┘
```

### 14.2 谁用什么记忆

| Agent | recent | observation | episodic | belief |
|---|---|---|---|---|
| ChapterDraftAgent | ❌ | ❌ | ❌ | ❌ |
| CharacterAgent | ✅ (本场推演) | ✅ (跨场推演) | ✅ | ✅ |
| DirectorAgent | ✅ (本场) | ❌ | ❌ | ❌ |
| ReaderSimulator | ✅ (跨章模拟阅读) | ✅ | ❌ | ❌ |

### 14.3 记忆隔离

- 角色 agent 的 thread_id = `{projectId}:char:{characterId}`，跨项目隔离
- 推演中，每个角色 agent 看到的 visible turns 严格按 `simulation_turns.visible_to` 过滤
- knowledge_lies 字段用于"角色被骗了"——他记忆里"知道"一个错误事实，要写回去给他

---

## 15. Issue 系统（详细）

### 15.1 生命周期

```
created (status=open)
  ├→ user 点"采纳" → in_progress → 应用 fix → resolved
  ├→ user 点"忽略" → dismissed
  ├→ auto-fixer 跑 → in_progress → resolved (status=auto_fixed)
  ├→ auto-fixer 失败 2 次 → escalated (severity 升级，status 仍 open)
  └→ 长期未处理（30 天）→ stale flag
```

### 15.2 路由规则（auto-fix vs escalate）

```ts
function shouldAutoFix(issue: Issue): boolean {
  if (issue.severity !== 'critical') return false
  if (issue.axis === 'aislop') return true       // 黑名单词
  if (issue.axis === 'canon' && hasObviousFix(issue)) return true
  if (issue.axis === 'continuity' && isLocalScope(issue)) return true
  return false
}
```

明确不自动修：pacing、theme、genre、reader、relationship。

### 15.3 关联与去重

- 同一段落内同 axis 的多个 issue 自动合并
- 跨章节但同一根因的 issue（"第 7、12、18 章李某性格漂移"）合并为一条主 issue + 三条引用
- issue.related_issue_ids 形成图

### 15.4 UI 视图

- 列表：filter by axis / severity / scope / status
- 看板：四列 open / in_progress / resolved / dismissed
- 仪表盘：按章节 / 卷 / 类型分布的热图

---

## 16. 文风系统（详细）

### 16.1 voice 卡的结构

```yaml
# voice_cards/{characterId}.md
name: 李某
scope: character
positive_samples:
  - "他不说话，就那样看着她。月光照在他眼里。"
negative_samples:
  - "他的眼中闪烁着复杂的光芒。"   # 太 AI
do_use:
  - 短句
  - 物理描写代替抽象情感
  - 偶尔的方言
dont_use:
  - 内心独白用 "他想"
  - "不禁" "不由"
  - 形容词堆叠
preferred_sentence_length: short
preferred_pov: third_limited
preferred_tense: past
```

### 16.2 anti-slop pre-processor

每次 ChapterDraftAgent 调用前注入：

```
你正在为 {characterId} 写台词/动作。请避免以下表达：
{rendered_blacklist_top_20}

并参考以下"对的样子"：
{positive_samples}
```

### 16.3 漂移检测

每章 finalize 后跑：

```
fingerprint = compute_metrics(chapter)
baseline = avg(last_5_chapter_fingerprints)
if abs(fingerprint - baseline) / baseline > threshold:
    create style_drift_alert
    raise issue
```

阈值：
- avg_sentence_length 漂移 > 25%
- vocab_richness 下降 > 15%
- repeated_phrases 命中数 > 3

---

## 17. 世界时钟（详细）

### 17.1 时间推进

```
配置: pace_config = { chapters_per_world_day: 0.5 }
意思: 平均每 2 章过 1 天

每章 finalize 时:
  current_world_date += days_advanced
  
  // days_advanced 由 ChapterSummaryAgent 报告
  // (它读章节文本判断"过了三天" / "次日清晨")
```

### 17.2 between-chapter event 生成

```
WorldTickAgent 输入:
  - 当前世界状态
  - 主角不在场的势力 / 角色
  - 剩余卷弧 beats
  - 已存在 between_chapter_events

输出:
  0-3 个事件:
    - text: "玄阴宗暗中调动了三百精锐"
    - visibility: hidden | hinted | revealed
    - visible_to_characters: []
    - triggers_in_chapter_id: 章节预测
```

`hidden` = 读者和主角都不知道（埋伏笔）
`hinted` = 读者知道一点（外围消息），主角不知道
`revealed` = 这事会被叙述

### 17.3 注入到下章生成

```
ChapterDraftAgent 拿到的 prompt 里有：
  ## 期间发生的事
  （仅供你了解，不一定要写明）
  - {hidden_events}
  
  ## 读者已知但角色不知
  - {hinted_events}
  
  ## 你应该叙述的
  - {revealed_events}
```

---

## 18. 版本控制（详细）

### 18.1 chapter_version 树

每个 chapter 是一棵树：

```
v1 (initial)
├── v2 (rewrite, parent=v1)
│   └── v4 (rewrite, parent=v2)  ← active
└── v3 (manual, parent=v1)
```

- `chapters.active_version_id = v4`
- 切换 active：UI 上有版本选择器

### 18.2 dependency 检测

每个 chapter_version 算 dependency 指纹：

```ts
{
  references_canon_ids: [...],
  references_character_states: { charId: stateHash },
  produces_summary_hash: "...",
  changes_world_state: { ... }
}
```

切换 active 时：
1. 算两版指纹差异
2. 找下游引用差异部分的章节
3. UI 列出："切换会影响第 8、12、15 章"
4. 用户选自动重生 / 手动看

### 18.3 命名分支

`version_branches` 表允许给版本起名："线索 A 走向"、"如果他没死"。便于实验性写作。

---

## 19. 可观测性（详细）

### 19.1 三层 trace

```
Job (top level)
├── child Job (workflow step)
│   ├── llm_call
│   ├── tool_call
│   └── agent_decision
└── child Job (parallel step)
    └── ...
```

### 19.2 关键指标 dashboard

按月 / 周 / 项目展示：
- 总 token in/out
- 总 cost USD
- 各 agent 调用次数 + 平均成本
- 各 prompt version 使用次数
- 各 reviewer 抓 issue 命中率（issues 被 user 接受 vs 忽略）
- 各 character 的 episodic memory 体积
- 章节平均生成时间
- auto-fix 成功率

### 19.3 回放

任何 job 可以"回放"：
- 显示完整 turn 历史
- 显示 agent 看到的 prompt（rendered）
- 显示 tool calls 的 input / output
- 允许"用新 prompt 重跑这个 job"对比

### 19.4 告警

- 单次 LLM 调用 cost > $0.50 → 红色 badge
- 单 job duration > 10 分钟 → 检查是否卡住
- 月度 cost > 预设阈值 → 邮件 / dashboard 红条

---

## 20. 配置、安全、部署

### 20.1 环境变量

```
# 数据库
DATABASE_URL=postgres://...
PGVECTOR_DIM=1024

# LLM
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
QWEN_API_KEY=
QWEN_BASE_URL=
SELF_HOSTED_QWEN_URL=          # optional
OPENROUTER_API_KEY=            # optional fallback

# Embedding
BGE_M3_URL=http://localhost:11434/embed
# 或
QWEN_EMBED_API_KEY=

# Mastra
MASTRA_TELEMETRY=true
MASTRA_OBSERVABILITY_PROVIDER=postgres

# 应用
NEXT_PUBLIC_APP_URL=
INTERNAL_API_TOKEN=            # 内部 API 调用
EXPORT_DIR=/data/exports

# 安全
SAFETY_DEFAULT_LEVEL=normal    # strict|normal|unrestricted
COST_BUDGET_MONTHLY_USD=50
```

### 20.2 安全策略

- 单用户系统，不做认证（compass 已有，复用）
- 所有 prompt / 用户输入做 zod 校验
- LLM 输出做 markdown 净化（防注入 HTML）
- 文件路径用 path.normalize 防 traversal
- exports 目录权限隔离

### 20.3 部署

- 单 Next.js 服务（含 Mastra runtime）
- Postgres 16 + pgvector
- bge-m3 单独 Docker 容器（可选）
- nginx 反代 + SSL
- pm2 / systemd 进程管理
- Postgres 每日 dump 到对象存储

资源建议：
- 4C / 8G / 100G SSD：足够个人使用
- 数据库和应用同机也行（你的 VPS 不大）

---

## 21. 评测体系

### 21.1 自动评测

每章 finalize 后自动算：

| 指标 | 算法 | 目标 |
|---|---|---|
| AI 味命中率 | slop blacklist 命中数 / 总词数 | < 0.5% |
| 句长方差 | std(sentence_lengths) | > baseline × 0.8 |
| 角色声音一致性 | VoiceReviewer 评分 | > 7/10 |
| canon 矛盾数 | CanonReviewer 抓的 critical 数 | 0 |
| 钩子强度 | HookAgent 评分 | > 6/10 |
| 卷命题贡献 | ThemeReviewer 评分 | > 5/10 |

### 21.2 人工评测

UI 上每章有 5 星评分（用户写完确认时填）。聚合成：
- 项目均分
- 各章节趋势线（识别哪些章质量下滑）

### 21.3 prompt A/B 实验

UI 提供"开启实验"按钮：
- 选两个 prompt version
- 设比例
- N 章后看 metric 差异
- 自动决定 winner（或手动）

### 21.4 模型对比评测

定期跑：同一段大纲让 DeepSeek、Qwen、自部署模型各写一遍，对比指标。

---

## 22. 扩展点

预留但不实现：

### 22.1 多用户
- 加 user_id 到所有表的复合 PK 即可
- 复用 compass 的 auth

### 22.2 协作
- 共享 project：加 project_collaborators 表
- 实时编辑：用 Y.js（Tiptap 已支持）

### 22.3 fine-tune
- llm_calls 已记录 input/output，导出成训练数据
- 留接口但不实现

### 22.4 移动端
- 改响应式 / PWA，但写作主战场是桌面

### 22.5 audio narration
- 章节 finalize 后跑 TTS
- 集成 ElevenLabs / 自部署 GPT-SoVITS

### 22.6 image generation
- 角色立绘、章节插画
- 集成 Stable Diffusion

### 22.7 publish
- 一键发布到起点 / 番茄等平台（用爬虫 / 官方 API）

### 22.8 多语言
- 翻译流水线，target_lang 加到 export

---

## 23. 与 compass / hermes 集成

### 23.1 数据集成

共享 Postgres 但 schema 隔离：
```
public.compass_*
public.hermes_*
public.novel_*  ← 本系统
```

跨系统查询通过明确的 view：
```sql
CREATE VIEW novel_writing_sessions AS
SELECT j.created_at, j.duration, p.title
FROM novel_jobs j
JOIN novel_projects p ON p.id = j.project_id
WHERE j.type = 'chapter_generation';
```

compass 的"今日总结"可以读这个 view。

### 23.2 hermes 触发集成

hermes 的 routine 可以触发本系统的操作：

```yaml
# hermes routines
- name: daily_writing_check
  schedule: "20:00"
  action:
    type: novel_call
    workflow: DailyProgressReport
```

本系统暴露一组"hermes 可调用 workflow"：
- DailyProgressReport（汇总今日字数 / issue / cost）
- WeeklyReview（卷 / 项目周报）
- ChapterGenerateAuto（按 outline 自动生成下一章，不需用户在场）

### 23.3 compass 反向集成

compass 的事件可以被本系统消费：
- 用户专注时长 ≥ X → 自动启动一章生成
- 用户情绪低落 → 暂缓沉重章节生成

---

## 24. 附录

### 附录 A: 核心 TS 类型

```ts
// types/agent.ts
export interface AgentContext {
  projectId: string
  volumeId?: string
  chapterId?: string
  characterId?: string
  userId: string
  jobId: string
  parentJobId?: string
}

// types/character.ts
export interface CharacterPrivateView {
  id: string
  name: string
  appearance: string
  publicRole: string
  secretMotive: string         // 仅自己看得到
  trueIntent: string
  knowledge: KnowledgeFacts
  // ...
}

export interface CharacterPublicView {
  id: string
  name: string
  appearance: string
  publicRole: string
  observableBehaviorHistory: ObservedAction[]
  // 注意：无 secretMotive、trueIntent
}

// types/simulation.ts
export interface SimulationTurn {
  idx: number
  speakerType: 'director' | 'character' | 'narrator' | 'injection'
  speakerId: string
  utterance: string
  reasoning?: string           // 仅 director、user、回放可见
  visibleTo: string[]
  timestamp: Date
}
```

### 附录 B: ChapterDraftAgent prompt 骨架

```markdown
---
name: chapter_draft
version: 1
model_preference: deepseek-v3.2-chat
temperature: 0.85
streaming: true
---

# 角色

你是 {{ project.title }} 的执笔者。本作类型为 {{ project.genre }}。

## 项目声音卡
{{ project.voice_md }}

## 类型契约
{{ genre_profile.contract }}

# 上下文

## 卷信息
卷 {{ volume.num }}：{{ volume.title }}
卷命题：{{ volume.thesis }}
当前所处弧位：{{ volume.current_arc_position }}

## 上一章摘要
{{ prev_summary }}

## 本章细纲
{{ chapter_outline }}

## 涉及人物（私密档案，写作时不要直接复述）
{{#each characters_present}}
### {{ this.name }}
- 公开身份：{{ this.public_role }}
- 真实动机：{{ this.secret_motive }}
- 当前情绪：{{ this.current_emotional_state }}
- 声音卡：{{ this.voice_md }}
{{/each}}

## 世界 bible 相关条目
{{ bible_extract }}

## 章节间发生的事
- 主角不知道但已发生：{{ hidden_events }}
- 读者已知线索：{{ hinted_events }}
- 本章应叙述：{{ revealed_events }}

# 写作要求

1. 字数目标 {{ target_word_count }}（允许 ±20%）
2. POV：{{ pov_character.name }}（{{ pov_type }}）
3. 推进 arc beat：{{ delivers_arc_beats }}
4. 章末必须留钩子：{{ hook_intent }}
5. 避开以下表达：
{{ slop_blacklist_top_20 }}

# 输出

直接输出 markdown 章节正文，不要前置说明、不要标题（标题已确定为 "{{ chapter.title }}"），不要加章节号。
```

### 附录 C: 评测自动化 cron

```ts
// cron/weekly-eval.ts
async function weeklyEval() {
  for (const project of activeProjects()) {
    const stats = computeWeeklyStats(project.id)
    // 写入 dashboard
    // 发送邮件 / 推送
    
    if (stats.avg_chapter_score < 6) {
      // 自动开启 prompt A/B 实验
      proposePromptExperiment(project.id, 'chapter_draft')
    }
  }
}
```

---

# 收尾

这套设计**故意做得比 MVP 大**——你说要比肩 hermes，那就要按 hermes 的标准来。

实际开工时按需取舍：
- 第一周不要碰 simulation、reviewer、style 这三块
- 第一周只做：projects + volumes + chapters + 单 LLM 章节生成 + Tiptap
- 验证主流水线通了再往上加
- Mastra 的高级 memory（observation/reflection）等到 Phase 4 推演时才需要，前期用 recent messages 就够

每加一个模块，记住先问一句："如果这个模块完全不存在，主流程还能跑吗？"——能跑，就晚一点做；不能跑，就立刻做。

文档本身也是一个 artifact——它会随着你写的过程发现新需求。**把这份 spec 也放在 git 里、随项目演化版本**。
