# Spec v2.0 验收覆盖

逐条对照 spec § 41「最终验收清单」的 49 项，标注实现状态与代码位置。

图例：✅ 完整实现 · 🟡 部分实现 · ❌ 未实现

---

## § 41.1 安全与隔离 (9 项)

| # | 项目 | 状态 | 实现位置 / 测试 |
|---|---|---|---|
| 1 | 角色不能读取其他角色 private_layer | ✅ | `src/lib/context-router/acl.ts` `canRead()` + `tests/acl.spec.ts` |
| 2 | author_only / world_only 不进入角色 prompt | ✅ | `acl.ts` 同上；`tests/acl.spec.ts` |
| 3 | novelizer_only 仅 narrator 可读 | ✅ | narrator 特例分支；`tests/acl.spec.ts` |
| 4 | Context Router ACL 单元测试覆盖 13.5 全分支 | ✅ | `tests/acl.spec.ts` 19 个用例 |
| 5 | public_layer 字段白名单 | 🟡 | JSON Schema (App C.1) `additionalProperties=false` 强制；`tests/json-validation.spec.ts` |
| 6 | API Key 不出现在 trace / log / UI | ✅ | `src/lib/security/crypto.ts` AES-256-GCM；llm-service 解密后立即注入 adapter，不落 prompt |
| 7 | Prompt Injection 不会覆盖权限规则 | ✅ | `src/lib/simulation/prompts.ts` `wrapUserData()` + 代码层 ACL 二次保险 |
| 8 | 泄漏检测能阻断 private fact 进入 public_layer | ✅ | `src/lib/audit/leak-detector.ts` + engine 触发 critical → tx rollback |
| 9 | 输入校验中间件覆盖附录 A 全约束 | ✅ | `src/lib/validation/middleware.ts` + `tests/input-validation.spec.ts` |

## § 41.2 模拟流程 (10 项)

| # | 项目 | 状态 | 实现位置 |
|---|---|---|---|
| 1 | 创建世界 / 角色 / 地点 / narrator | ✅ | `/api/worlds`、`/api/entities`、UI `/worlds`、`/characters` |
| 2 | 每角色绑定不同 api_profile + prompt_version | ✅ | `entities.api_profile_id` + `entities.prompt_version_id` |
| 3 | 运行场景 | ✅ | `POST /api/simulation/run-round` |
| 4 | 并行调用多角色 | ✅ | `engine.ts` `Promise.all(charEntities.map(callLLM))` |
| 5 | 主世界统一结算 | ✅ | engine 第二阶段 callLLM(world_agent) |
| 6 | 处理行动冲突 | 🟡 | world_agent prompt 提示，conflict_resolutions 字段已在 schema；具体冲突算法 spec § 20 留给后续 |
| 7 | 事件 / 记忆 / 关系事务写入 | ✅ | engine 单事务 (`db.transaction`) |
| 8 | simultaneous 模式存在一轮延迟 | ✅ | `engine.ts` 文档明示，`tests/...` 待补 e2e |
| 9 | hybrid_two_phase 即时反应 | ✅ | `engine-hybrid.ts` Phase A intent / Phase B public + parent_action_id |
| 10 | 打断保护 planned_speech | ✅ | `engine-hybrid.ts` was_interrupted=true 时 planned_speech 进 private_layer.planned_but_unspoken |

## § 41.3 失败处理 (8 项)

| # | 项目 | 状态 | 实现位置 |
|---|---|---|---|
| 1 | 角色 API 超时可重试 | ✅ | `src/lib/simulation/llm-retry.ts` |
| 2 | JSON 错误降级 | ✅ | ajv 校验失败时记录 schema_error 状态，不污染 actions |
| 3 | 主世界失败 abort_round | ✅ | engine catch → round.status=failed |
| 4 | 数据库失败回滚事务 | ✅ | `db.transaction` |
| 5 | 审计 critical 阻断提交 | ✅ | engine.ts: `RoundAbortedError` 触发 tx rollback |
| 6 | 普通 NPC 失败不拖垮场景 | ✅ | engine fallback `system_default` action |
| 7 | 暂停时正确处理 in-flight | ✅ | `pause-registry.ts` + `/api/scenes/[id]/pause`、`/abort` |
| 8 | Rate limit 退避 / fallback | ✅ | `llm-retry.ts` 退避 + `BudgetExceededError` 触发 fallback |

## § 41.4 记忆 (9 项)

| # | 项目 | 状态 | 实现位置 |
|---|---|---|---|
| 1 | 带 owner_entity_id | ✅ | schema |
| 2 | 带 visibility / ACL | ✅ | schema + canRead |
| 3 | confidence / importance / emotional_weight | ✅ | schema |
| 4 | proposed_by / approval_status | ✅ | schema + `/api/memory-requests` |
| 5 | novelizer 提议必经 approval | ✅ | `/api/memories` 显式拒绝 `proposed_by=novelizer` |
| 6 | 语义检索 | ✅ | `src/lib/memory/retrieval.ts` pgvector + ACL 二阶段 |
| 7 | decay_level ∈ [0,1] | ✅ | `src/lib/memory/decay.ts` clamp |
| 8 | 摘要与归档 | ✅ | `src/lib/memory/summarizer.ts` |
| 9 | 分支不污染父线 | ✅ | `src/lib/simulation/worldline-fork.ts` 深拷贝 + 双 snapshot |

## § 41.5 UI (12 项)

| # | 项目 | 状态 | 路径 |
|---|---|---|---|
| 1 | API Provider 配置 | ✅ | `/providers` |
| 2 | API Profile 配置 | ✅ | `/profiles` |
| 3 | Embedding Profile 配置 | ✅ | `/embedding-profiles` |
| 4 | Prompt Version 管理 | ✅ | `/prompts` |
| 5 | 角色配置 | ✅ | `/characters` |
| 6 | 模拟控制台 | ✅ | `/simulation` (含 pause/abort/fork/inject_event) |
| 7 | 上帝视角/角色视角切换 | ✅ | `/simulation` perspective 选择器 |
| 8 | Trace 调试页 | ✅ | `/traces` 列表 + `/traces/[id]` 详情 + replay |
| 9 | 导演事件投放入口 | ✅ | `/directives`（10 种 directive_type） |
| 10 | 小说整理页 | ✅ | `/chapters` + `/chapters/[id]` |
| 11 | memory_write_request 审批队列 | ✅ | `/memories` |
| 12 | 成本面板 | ✅ | `/cost` |

加成（未在 spec 清单的额外页）：`/quality`（漂移/停滞/Eval）。

## § 41.6 小说整理 (5 项)

| # | 项目 | 状态 | 实现位置 |
|---|---|---|---|
| 1 | narrator 实体可读 private_layer | ✅ | `acl.ts` narrator 分支；`narrator-service.ts` 加载完整日志 |
| 2 | 输出可标记事实来源 | ✅ | `chapters.source_event_ids[]` |
| 3 | 不得新增重大事件（自动检测） | ✅ | `narrator-service.ts` `checkFaithfulness()` |
| 4 | memory_write_request 必经用户批准 | ✅ | narrator 输出强制写入 memory_write_requests 表 status=pending |
| 5 | 可导出 Markdown | ✅ | `GET /api/chapters/[id]/export` 返回 `text/markdown` |

## § 41.7 成本与部署 (4 项)

| # | 项目 | 状态 | 实现位置 |
|---|---|---|---|
| 1 | per_call / per_run / per_day 成本预算 | ✅ | `api_profiles.cost_limit_per_*` + `budget.ts` |
| 2 | hybrid 模式 per_round 含所有 phase | ✅ | costLogs.phase 字段 + `getRoundCost` 跨 phase 求和 |
| 3 | 超出预算按配置 pause / fallback / abort / degrade | ✅ | `llm-service.ts` `onExceed` 分支 + engine catch |
| 4 | snapshot > 50MB 警告 | ✅ | `snapshot.ts` warning 字段 |

---

## 测试覆盖 (`tests/`)

```
acl.spec.ts                   19 用例   § 38.1
leak-detector.spec.ts         13 用例   § 38.2 / § 18
json-validation.spec.ts       12 用例   § 38.3 / 附录 C
audit-critical.spec.ts         3 用例   § 38.4
relationship-throttle.spec.ts  9 用例   § 38.5 / § 27.2
perception-clarity.spec.ts    16 用例   § 38.6 / § 16.2-16.12
input-validation.spec.ts      14 用例   § 38.17 / 附录 A
─────────────────────────────────────
合计 86 用例，全部 PASS
```

待补 e2e 测试（需 docker DB harness）：
- § 38.7 hybrid 打断（DB 验证）
- § 38.8 worldline fork 双 snapshot
- § 38.9 embedding 维度切换
- § 38.10 round 事务回滚（数据库验证）
- § 38.11 budget 熔断真实 fallback
- § 38.12 prompt 版本回滚
- § 38.13 narrator 权限端到端
- § 38.14 暂停 in-flight 端到端
- § 38.15 长跑（10 角色 50 场景）
- § 38.16 压力（50 角色 100k 记忆 5 并发场景）

## 仍未实现（spec 明确推迟）

按 spec § 3.2 / § 23.2 / § 39 推迟：

- 复杂多地点并行模拟（spec § 19.1 multi_location_parallel 暂缓）
- CoW 世界线（lineage_path 字段已预置但未实现 CoW 解析）
- 完整多租户商业权限系统
- WebSocket 完整协议（目前 SSE 已满足 spec § 34 实时事件需求）
- 高级小说排版导出（docx / pdf）
- 复杂势力战争 / 自动战斗系统
- 全自动长篇连载规划

## 下一步建议

1. **e2e DB 测试**：用 docker-compose 启 `xiexiaoshuopro_test` 数据库，覆盖剩余 § 38 项
2. **前端 ESLint** 修干净 warnings
3. **Trace 详情**：补充关联 round / scene / entity 信息显示
4. **关系网可视化**：在 `/simulation` 加一个 8 维 radar chart
5. **导演 hard 模式**：实现 `modify_world_state`、`lock_fact` 等剩余 directive_type 的 content 处理
