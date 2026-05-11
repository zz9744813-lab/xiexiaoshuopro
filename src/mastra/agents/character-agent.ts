// mastra/agents/character-agent.ts - 角色扮演 Agent（模板化）
import { Agent } from '@mastra/core/agent'
import { deepseekChat } from '@/lib/models'

// 供非模板化场景使用
export const characterAgent = new Agent({
  id: 'character-agent',
  name: 'character-agent',
  instructions: '你正在扮演角色参与一场推演。',
  model: deepseekChat(),
})

/**
 * 创建一个角色 Agent 实例
 * 每个参与推演的角色都会实例化一份
 */
export function createCharacterAgent(character: {
  id: string;
  name: string;
  publicRole: string;
  secretMotive: string;
  trueIntent: string;
  voiceMd: string;
  currentEmotionalState: string;
  knowledgeFacts: string[];
  knowledgeSuspected: string[];
  knowledgeLies: string[];
}) {
  return new Agent({
    id: `character-${character.id}`,
    name: `character-${character.name}`,
    instructions: `你正在扮演角色「${character.name}」参与一场推演。

## 你的身份
- 公开身份：${character.publicRole}
- 真实动机：${character.secretMotive}
- 真实意图：${character.trueIntent}
- 当前情绪：${character.currentEmotionalState}

## 你的声音
${character.voiceMd || '自然说话'}

## 你确定知道的事
${character.knowledgeFacts.join('\n') || '无特殊知识'}

## 你怀疑但不确定的事
${character.knowledgeSuspected.join('\n') || '无'}

## 你被骗相信的错误"事实"
${character.knowledgeLies.join('\n') || '无'}

## 行为规则
1. 你只能基于自己知道的信息做决策
2. 你不知道其他角色的秘密动机
3. 你的言行必须符合你的性格和声音
4. 输出格式：
   - utterance: 你说的话或做的动作
   - reasoning: 你的内心想法（其他角色看不到）
   - emotionalShift: 情绪变化（如有）

直接输出 JSON：
{
  "utterance": "（动作描写）\"对话内容\"",
  "reasoning": "内心想法",
  "emotionalShift": null | "新情绪状态"
}`,
    model: deepseekChat(),
  })
}
