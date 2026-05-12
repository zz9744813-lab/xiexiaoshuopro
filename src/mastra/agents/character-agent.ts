// mastra/agents/character-agent.ts - 角色扮演 Agent（模板化，prompt 文件模式）
import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync, parseFrontmatter, renderPrompt } from '@/lib/prompts'

const promptRaw = readPromptSync('agents/character-agent.md')
const { body: promptTemplate } = promptRaw
  ? parseFrontmatter(promptRaw)
  : { body: '你正在扮演角色参与推演。输出 JSON。' }

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
  const instructions = renderPrompt(promptTemplate, {
    name: character.name,
    public_role: character.publicRole,
    secret_motive: character.secretMotive,
    true_intent: character.trueIntent,
    voice_md: character.voiceMd || '自然说话',
    current_emotional_state: character.currentEmotionalState || '平静',
    knowledge_facts: (character.knowledgeFacts || []).join('\n') || '无特殊知识',
    knowledge_suspected: (character.knowledgeSuspected || []).join('\n') || '无',
    knowledge_lies: (character.knowledgeLies || []).join('\n') || '无',
  })

  return new Agent({
    id: `character-${character.id}`,
    name: `character-${character.name}`,
    instructions,
    model,
  })
}
