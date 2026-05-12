import { Agent } from '@mastra/core/agent'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { readPromptSync } from '@/lib/prompts'import {{ getCharacterProfile, getCharacterKnowledge }} from '../../tools/'

export function relationshipReviewer(model: LanguageModelV1) {
  return new Agent({
    id: 'relationship-reviewer',
    name: 'relationship-reviewer',
    instructions: readPromptSync('agents/reviewer/relationship.md')
      || '检查角色关系的演变是否自然、一致，关系转折是否有铺垫。输出 JSON 数组。',
    model,
  })
}
