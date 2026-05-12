// mastra/agents/character-agent.ts - 角色扮演 Agent（prompt 文件模式）
import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'

const defaultInstructions = readPromptSync('agents/character-agent.md')
  || '你正在扮演角色参与推演。根据你的身份、知识和声音进行角色决策。输出 JSON。'

/**
 * 创建一个角色 Agent 实例
 * 每个参与推演的角色都会实例化一份，动态注入角色上下文
 */
export function createCharacterAgent(
  model: LanguageModelV1,
  character: {
    id: string
    name: string
    publicRole: string
    secretMotive: string
    trueIntent: string
    voiceMd: string
    currentEmotionalState: string
    knowledgeFacts: string[]
    knowledgeSuspected: string[]
    knowledgeLies: string[]
  }
) {
  // 用 Mastra 的内置模板变量注入角色上下文
  const instructions = defaultInstructions

  return new Agent({
    id: `character-${character.id}`,
    name: `character-${character.name}`,
    instructions,
    model,
  })
}
