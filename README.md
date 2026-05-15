# 多智能体可视化小说模拟系统

> Multi-Agent Visual Novel Simulation System
>
> 基于 Spec v2.0 实现，当前为 **MVP Phase 1 骨架**。

## 这是什么

一个让多个 AI 角色在受控规则下独立行动、交流、误解、隐瞒的可视化模拟系统。

不是普通的 AI 写小说工具：

- 普通 AI 写小说：用户给设定 → AI 直接生成剧情和正文
- 本系统：用户给世界和角色 → 角色在规则约束下独立行动 → 主世界记录真实事件 → 小说整理器把事件文学化

## 核心设计原则

1. **代码层硬隔离** - LLM 永远不能成为安全边界
2. **角色之间不能直接通信** - 必须经过 Context Router
3. **private_layer 不能进入其他角色上下文** - 由 ACL 强制
4. **API Key 不能进入前端、Prompt、Trace 或导出文件**
5. **小说整理器不能改变模拟事实**

## 技术栈

- 前端 + 后端：Next.js 16 + TypeScript + React 19 + TailwindCSS
- 数据库：PostgreSQL 16 + pgvector
- ORM：Drizzle
- 队列：BullMQ + Redis
- 校验：Zod + Ajv

## 快速开始

### 1. 启动数据库

```bash
npm run docker:up
```

数据库数据会写到本地 `.docker-data` 目录（位于 F 盘项目目录），不会进 C 盘。

### 2. 配置环境变量

复制 `.env.example` 到 `.env`，并修改 `ENCRYPTION_KEY`（必须 ≥ 16 字符，用于加密 API Key）。

### 3. 推送数据库 Schema

```bash
npm run db:push
```

### 4. 启动开发服务器

```bash
npm run dev
```

打开 http://localhost:3000

## 当前已完成（Phase 1 骨架）

- [x] 数据库 Schema（20 张表）
- [x] 输入校验中间件（附录 A）
- [x] API Provider / Profile / Embedding Profile CRUD
- [x] Entity / Character / Narrator 创建
- [x] Memory 系统（含 ACL / proposed_by / approval_status）
- [x] Context Router ACL 过滤（含 narrator 特例 + 上下文截断）
- [x] 感知清晰度计算（spec 16.2-16.12）
- [x] LLM Adapter（OpenAI 兼容 + Anthropic）
- [x] 单场景 simultaneous 模拟流程
- [x] 主世界结算 + 后置校验
- [x] 事件 / 记忆 / 关系事务写入
- [x] Trace 与审计（含泄漏检测）
- [x] 基础 Web UI（首页 / 世界 / Provider 管理）
- [x] Docker Compose 配置

## 后续 Phase（参见 spec v2.0）

- Phase 2：模拟控制台 / Trace 调试 / Prompt Replay / WebSocket
- Phase 3：pgvector 检索 + 摘要 + 衰减 / 世界线 fork / hybrid_two_phase
- Phase 4：narrator 实体 + 章节生成 + memory_write_request 审批
- Phase 5：漂移检测 / 停滞兜底 / Eval

## 目录结构

```
src/
├── app/                  Next.js App Router
│   ├── api/              API 路由
│   ├── worlds/           世界管理 UI
│   ├── providers/        Provider 配置 UI
│   └── page.tsx          主页
├── db/
│   ├── schema/           Drizzle 表定义
│   ├── migrations/       自动生成的迁移
│   └── index.ts          数据库连接
└── lib/
    ├── audit/            审计 / 泄漏检测
    ├── context-router/   ACL + 视角上下文 + 截断
    ├── llm/              LLM Adapter
    ├── memory/           记忆衰减 / 评分
    ├── perception/       感知清晰度计算
    ├── security/         API Key 加密
    ├── simulation/       模拟引擎
    └── validation/       输入校验 + JSON Schema
```

## 安全保证（代码层硬约束）

- ACL 由 `src/lib/context-router/acl.ts` 的 `canRead()` 强制
- private_layer 在 Context Router 中被过滤
- author_only 仅作者后台可读
- novelizer 实体享有特例（13.4），可读 private 但不能读 author_only
- API Key 由 AES-256-GCM 加密存储，绝不进入前端 / prompt / trace
- LLM 输出经 JSON Schema 校验
- 主世界输出经后置校验（spec 27）
- 泄漏检测算法 = 事实抽取 + 实体匹配 + 高风险词 + 辅助 embedding

## 文档

完整规格书见 `agent_story_system_engineering_spec_v2_0.md`（如果存在）。
