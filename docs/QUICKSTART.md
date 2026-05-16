# 快速开始 (Quickstart)

> 5 个命令从零跑通一轮 mock 模拟（不消耗任何真实 LLM 配额）。

## 前置要求

- Node.js ≥ 20
- Docker Desktop（用于 PostgreSQL + pgvector + Redis）
- F 盘有空间（C 盘不会被写入）

## 步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 启动数据库 + Redis

```bash
npm run docker:up
```

数据卷挂在项目目录的 `.docker-data/` 下，不会写 C 盘。

### 3. 配置环境变量

```bash
copy .env.example .env
```

打开 `.env`，**必须**改 `ENCRYPTION_KEY`（≥ 16 字符随机串），用于加密 API key。

### 4. 推送数据库 schema

```bash
npm run db:push
```

执行 Drizzle schema → PostgreSQL，启用 `vector` 扩展。

### 5. 灌入 demo 数据 + 启动应用

```bash
npm run db:seed
npm run dev
```

打开 http://localhost:3000，依次：

1. **首页** → 看到 1 个世界「雾城试验场」
2. **/simulation** → 选中 pending 场景「地下酒馆 · 第一夜」
3. 点 **运行下一轮** → mock provider 返回固定 JSON
4. 看到沈鸢 / 林澈各自 public_layer + 仅自己视角的 private_layer
5. **/traces** → 4 条 trace（character × 2 + world_agent + 可能的 audit）
6. **/cost** → cost = $0（mock 免费）
7. **/chapters** → 选第一个事件 → narrator 生成章节 → 看忠实度报告

完成。

## 切到真实 LLM

1. **/providers** → 添加 OpenAI / Anthropic / DeepSeek 等 provider，填真实 API Key
2. **/profiles** → 创建针对该 provider 的 profile（如 gpt-4o-mini）
3. **/characters** → 把每个角色绑定到对应的 profile（不绑则用 mock）
4. **/embedding-profiles** → 配置该 world 的 embedding 模型（OpenAI text-embedding-3-small 推荐）
5. 重新跑一轮 → 看真实成本

## 常用操作

```bash
npm run typecheck    # tsc --noEmit
npm run test         # vitest 86 个单元测试
npm run build        # Next.js 生产构建
npm run worker       # BullMQ async 模式 worker
npm run worker:decay # 记忆衰减后台任务
npm run docker:down  # 停掉 postgres + redis
```

## 端口

- Web UI / API: `http://localhost:3000`
- PostgreSQL: `localhost:5432` (postgres / postgres / xiexiaoshuopro)
- Redis: `localhost:6379`

## 故障排除

**ENCRYPTION_KEY too weak**: `.env` 里必须 ≥ 16 字符。

**docker compose 启动失败**: 确认 Docker Desktop 在跑；试 `docker ps` 看容器。

**db:push 报 vector 扩展不存在**: 确认 docker-compose.yml 用的是 `pgvector/pgvector:pg16` 镜像。

**模拟跑了一轮没 actions**: 检查角色是否绑定了 api_profile（mock 也算）；检查 entities.api_profile_id 不为空。

**真实 LLM 调用 401**: provider 的 API Key 加密保存，需要从 UI **/providers/{id}/test** 点测试连接确认。
