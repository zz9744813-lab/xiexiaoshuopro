# 多智能体可视化小说模拟系统

> Multi-Agent Visual Novel Simulation System
> 基于 Spec v2.0 实现，**Phase A + B + C + D + E 已完成**。

## 这是什么

一个让多个 AI 角色在受控规则下独立行动、交流、误解、隐瞒的可视化模拟系统。不是 AI 写小说工具：

- 普通 AI 写小说：用户给设定 → AI 直接生成剧情和正文
- 本系统：用户给世界和角色 → 角色独立行动 → 主世界记录真实事件 → 小说整理器把事件文学化

剧情是**从角色行动、记忆、误解、欲望和世界规则中长出来的**，不是直接编出来的。

## 核心设计原则（红线）

1. **代码层硬隔离** — LLM 永远不能成为安全边界
2. **角色之间不能直接通信** — 必须经过 Context Router
3. **private_layer 不能进入其他角色上下文** — 由 ACL 强制
4. **API Key 不能进入前端 / Prompt / Trace / 导出文件** — AES-256-GCM 加密
5. **小说整理器不能改变模拟事实** — 自动忠实度检测

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 + 后端 | Next.js 16 + TypeScript + React 19 + TailwindCSS |
| 数据库 | PostgreSQL 16 + pgvector |
| ORM | Drizzle |
| 队列 | BullMQ + Redis |
| 实时事件 | Server-Sent Events |
| 校验 | Zod + Ajv |
| 测试 | Vitest |

## 当前实现 (Phase A-E)

### 数据 / 安全
- 22 张 Drizzle schema（含 pgvector embedding 列）
- ACL `canRead()` 覆盖 10 种 visibility，含 narrator 特例
- AES-256-GCM 加密 API Key
- 输入校验中间件（spec 附录 A 全字段）
- LLM 输出 JSON Schema 校验（附录 C）

### 模拟引擎
- simultaneous + hybrid_two_phase 两种模式
- 失败重试 + fallback + rate-limit 退避
- 成本预算（per_call/round/scene/day）+ 熔断
- 打断机制（was_interrupted）
- 导演指令（soft/hard，10 种类型）
- pause / abort / discard 完整路径
- round 级事务，critical audit 自动回滚

### 长期记忆
- pgvector 语义检索 + ACL 二阶段过滤
- 衰减公式（spec § 14.2-14.3）+ reinforcement
- 摘要 + 归档（不硬删除）
- novelizer 提议必经审批队列

### 分支与回滚
- Worldline fork（深拷贝 + 双 snapshot）
- snapshot 创建：scene_start / scene_end / fork / user_checkpoint
- `restoreSnapshotToWorldline()` 完整实现，单事务
- round 级 ROLLBACK

### 小说生产
- narrator 实体读 private_layer 但不读 author_only
- 自动忠实度检查（被打断台词 / 命名实体覆盖）
- 章节状态流转（draft / reviewing / published / archived）
- Markdown 导出

### 质量与运营
- 角色漂移检测（4 维度评分）
- 剧情停滞检测（含 hybrid 心理戏排除）
- 场景质量 Eval（8 项指标）
- 项目全量导出（默认脱敏 private_layer）

### UI（13 个页面）
- 世界、Provider、Profile、Embedding Profile、Prompt Version
- 角色、模拟控制台（带 pause/abort/fork/inject_event/视角切换）
- 导演投放、质量检测、章节、Trace（列表 + 详情 + Replay）
- 记忆审批、成本仪表盘

### 测试
- 86 个单元测试，覆盖 spec § 38.1-38.6 / 38.17 全部安全相关项

## 快速开始

```bash
npm install
npm run docker:up         # postgres + redis
copy .env.example .env    # 改 ENCRYPTION_KEY (>=16 字符)
npm run db:push           # schema → DB
npm run db:seed           # demo 世界 + 2 角色 + mock provider
npm run dev               # http://localhost:3000
```

详细见 [`docs/QUICKSTART.md`](docs/QUICKSTART.md)。

## 命令

```bash
npm run dev           # 开发服务器（webpack）
npm run build         # 生产构建
npm run typecheck     # tsc --noEmit
npm run test          # vitest 86 个单元测试
npm run db:push       # 推送 schema
npm run db:seed       # 灌入 demo 数据
npm run worker        # BullMQ async round worker
npm run worker:decay  # 记忆衰减后台任务
npm run docker:up     # 启动 postgres + redis
npm run docker:down   # 停止
```

## 目录结构

```
src/
├── app/                  Next.js App Router
│   ├── api/              35+ API routes
│   ├── _components/      共享组件（top-nav 等）
│   └── (pages)/          13 个 UI 页面
├── db/
│   ├── schema/           22 张 Drizzle 表定义
│   ├── seed.ts           幂等 demo 数据
│   └── index.ts          数据库连接
└── lib/
    ├── audit/            泄漏检测
    ├── context-router/   ACL + 视角上下文 + 截断
    ├── events/           SSE 事件总线
    ├── export/           项目导出
    ├── llm/              LLM Adapter (OpenAI/Anthropic/Mock)
    ├── memory/           衰减 / 检索 / 摘要 / writer / embedding
    ├── perception/       感知清晰度
    ├── security/         API Key 加密
    ├── simulation/       引擎、调度、director、narrator、quality
    └── validation/       输入校验 + JSON Schema
scripts/                  worker / decay-worker
tests/                    7 个 vitest 文件
docs/                     QUICKSTART, SPEC_COVERAGE
```

## 文档

- [`docs/QUICKSTART.md`](docs/QUICKSTART.md) — 5 分钟跑通 demo
- [`docs/SPEC_COVERAGE.md`](docs/SPEC_COVERAGE.md) — Spec § 41 验收清单 49 项逐条覆盖

## C 盘保护

整个项目不写入 C 盘：

- npm cache 配置在 F 盘
- Docker volumes 挂载到项目内 `.docker-data/`
- `.env`（含 ENCRYPTION_KEY）在 `.gitignore`，不提交

## License

MVP 私有项目，未公开 license。
