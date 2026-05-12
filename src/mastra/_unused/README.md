# _unused — 暂未接入的 Agent

这些 agent 文件已实现但当前未被任何 workflow 或 API route 使用。
保留在此以备将来接入。

## 将来使用计划

| Agent | 计划用途 | Phase |
|-------|---------|-------|
| characterCreator | Phase E 回写流程 — 新建角色 | E4 |
| characterEvolver | Phase E 回写流程 — 角色弧演化 | E4 |
| relationshipMapper | Phase E 回写流程 — 关系变更 | E4 |
| qualityGate | Phase C2 审查最后一道闸 | C2 |
| canonFixer | Phase C 自动修复 canon 问题 | C1 |
| continuityFixer | Phase C 自动修复 continuity 问题 | C1 |
| slopFixer | Phase C 自动修复 slop 问题 | C1 |
| plotWeaver | 暂不规划 | - |
| tensionArcher | 暂不规划 | - |
| dialogueSmith | 暂不规划 | - |
| descriptionPainter | 暂不规划 | - |
| worldBuilder | 暂不规划 | - |
| readerProxy | 暂不规划 | - |
| volumePlanner | 暂不规划 | - |
| chapterReviewer | 暂不规划 | - |
| chapterGenerator | 暂不规划 | - |
| chapterFixer | 暂不规划 | - |

## 规则
- 每个 agent 必须满足其一：在 mastra/index.ts 注册并被使用，或在此目录
- 如需启用某 agent，从本目录移回 agents/ 并注册
