// mastra/agents/volume-outline.ts - 卷大纲 Agent
import { Agent } from '@mastra/core/agent'
import { readPromptSync } from '@/lib/prompts'
import { deepseekChat } from '@/lib/models'

const instructions = readPromptSync('agents/volume-outline.md') || `你是一位小说架构师。你的任务是从卷命题展开三幕弧和 arc beats。

要求：
1. 设计清晰的三幕结构（起、承转、合）
2. 每幕包含 3-5 个 arc beats
3. 每个 beat 指定目标章节范围
4. 确保整体节奏合理

输出 JSON 格式：
{
  "acts": [
    {"act": 1, "name": "起", "beats": [{"name": "...", "targetChapter": 1, "description": "..."}]}
  ],
  "readerPromise": "这卷给读者的承诺",
  "estimatedChapters": 20
}`

export const volumeOutlineAgent = new Agent({
  id: 'volume-outline',
  name: 'volume-outline',
  instructions,
  model: deepseekChat(),
})
