// mastra/agents/hook.ts - 章末钩子 Agent
import { Agent } from '@mastra/core/agent'
import { readPromptSync } from '@/lib/prompts'
import { deepseekChat } from '@/lib/models'

const instructions = readPromptSync('agents/hook.md') || `钩子 Agent — 请检查 prompts/agents/hook.md 文件是否存在并加载。

钩子类型：
1. 悬念型：揭示新信息但留下更大疑问
2. 危机型：角色面临即将到来的威胁
3. 反转型：出乎意料的发展
4. 情感型：强烈的情感冲击
5. 承诺型：暗示下一章将有重要事件

评估标准：
- 钩子强度 1-10（6 以下需要重写）
- 是否与下章细纲衔接
- 是否过于刻意

如果钩子弱（< 6），提供重写建议。

输出 JSON：
{
  "score": 7,
  "hookType": "悬念型",
  "analysis": "分析说明",
  "needsRewrite": false,
  "suggestedRewrite": "如需重写，提供新的章末段落"
}`

export const hookAgent = new Agent({
  id: 'hook',
  name: 'hook',
  instructions,
  model: deepseekChat(),
})
