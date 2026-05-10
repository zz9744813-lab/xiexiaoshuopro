# 写小说 Pro - AI 协同长篇小说创作系统

> 以故事 Bible + 多 Agent 协作为核心，AI 主导生成、人类主导决策

## 技术栈

- **框架**: Next.js 16 (App Router) + TypeScript
- **AI**: Mastra Agent Framework + Vercel AI SDK
- **LLM**: DeepSeek (主力) / Qwen (备用) / 自部署 (兜底)
- **数据库**: PostgreSQL 16 + pgvector + Drizzle ORM
- **编辑器**: Tiptap
- **样式**: Tailwind CSS

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 DATABASE_URL 和 DEEPSEEK_API_KEY

# 3. 初始化数据库
npx drizzle-kit push

# 4. 启动开发服务器
npm run dev
```

## 核心功能

- **项目管理**: 创建/设置/导出项目
- **项目启动向导**: AI 生成命题 → 卷大纲 → 章节细纲
- **章节生成**: 流式 AI 写作 + 自动保存 + 摘要生成
- **段落重写**: 选中文本定向重写
- **角色管理**: 三级人物体系 (principal/recurring/walk_on)
- **世界观 Bible**: 硬性事实 + 世界条目管理
- **多 Agent 推演**: 角色扮演式场景推演
- **审查系统**: AI 味检测 + 8 个 Reviewer Agents + Issue 队列
- **文风管理**: Voice Cards + Slop 黑名单
- **版本控制**: 章节多版本 + 切换
- **世界时钟**: Between-chapter events 生成
- **可观测性**: 任务追踪 + 成本统计
- **导出**: Markdown 全书导出

## 项目结构

```
src/
├── app/                          # Next.js 页面和 API (31 路由)
│   ├── api/                      # REST API
│   └── projects/                 # 页面
├── db/                           # Drizzle ORM Schema (30+ 表)
├── lib/                          # 工具库 (LLM路由/Prompt/Slop检测)
├── mastra/                       # Mastra Agent 框架
│   ├── agents/                   # 8 核心 + 8 Reviewer Agents
│   └── tools/                    # 4 Tools
├── components/                   # Tiptap 编辑器
└── types/                        # TypeScript 类型
prompts/                          # Prompt 模板库
├── agents/                       # Agent prompts
├── genre_profiles/               # 5 类型配置
└── slop_dictionaries/            # AI 味黑名单 (20+ 规则)
```

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| DATABASE_URL | 是 | PostgreSQL 连接串 |
| DEEPSEEK_API_KEY | 是 | DeepSeek API Key |
| QWEN_API_KEY | 否 | 通义千问 (备用) |
| SELF_HOSTED_QWEN_URL | 否 | 自部署 Qwen (兜底) |
| OPENROUTER_API_KEY | 否 | OpenRouter (应急) |

## 设计文档

详见 [SYSTEM-DESIGN.md](./SYSTEM-DESIGN.md)
