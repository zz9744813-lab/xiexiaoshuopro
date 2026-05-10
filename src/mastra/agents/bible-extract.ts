// mastra/agents/bible-extract.ts - Bible 抽取 Agent
import { Agent } from '@mastra/core/agent'
import { readPromptSync } from '@/lib/prompts'
import { deepseekChat } from '@/lib/models'

const instructions = readPromptSync('agents/bible_extract.md') || `你是一位小说世界观管理员。你的任务是从已完成的章节中提取硬性事实和世界观条目。

提取规则：
1. 硬性事实（canon_facts）：不可违反的确定信息
   - 角色年龄、身份、关系
   - 地点名称和特征
   - 时间线事件
   - 体系规则

2. 世界条目（world_entries）：可演化的世界信息
   - 新出现的地点
   - 新出现的物品/功法
   - 新出现的势力/组织
   - 新出现的概念/规则

输出 JSON：
{
  "canonFacts": [{"fact": "...", "category": "人物|地理|时间|规则", "immutable": true/false}],
  "worldEntries": [{"kind": "location|item|magic|faction|concept|rule", "name": "...", "description": "..."}]
}

只提取明确出现在文本中的信息，不要推测。`

export const bibleExtractAgent = new Agent({
  id: 'bible-extract',
  name: 'bible-extract',
  instructions,
  model: deepseekChat(),
})
