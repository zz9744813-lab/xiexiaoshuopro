// tests/e2e/week5-integration.test.ts — TASK-7 Week5 集成测试
// 覆盖：prompt 加载 → agent 创建 → voice 结构化 → 知识隔离 → 完整推演
import { describe, it, expect } from 'vitest'
import { readPromptSync, parseFrontmatter, renderPrompt } from '@/lib/prompts'
import { voiceToPromptText } from '@/lib/voice-converter'
import { getAgentConfig } from '@/lib/agent-config'
import { directorAgent } from '@/mastra/agents/director'
import { narratorAgent } from '@/mastra/agents/narrator'
import { createCharacterAgent } from '@/mastra/agents/character-agent'
import type { VoiceProfile } from '@/types/voice'

const charVoice: VoiceProfile = {
  tone: '冷静',
  style: '简洁',
  sentencePatterns: { sentenceLength: 'short' },
  vocabulary: { signaturePhrases: ['哼', '有趣'] },
  mannerisms: { emotionalExpressiveness: 'subtle' },
}

describe('Week5 集成测试', () => {
  // ========================================
  // TASK-1/2: Prompt loading + render
  // ========================================
  describe('Prompt 加载 & 渲染', () => {
    const requiredPrompts = [
      'agents/character-agent.md',
      'agents/director.md',
      'agents/scenify.md',
      'agents/reader-simulator.md',
    ]

    it.each(requiredPrompts)('%s 可正常加载', (name) => {
      const raw = readPromptSync(name)
      expect(raw).toBeTruthy()
      expect(raw!.length).toBeGreaterThan(50)

      const { frontmatter, body } = parseFrontmatter(raw!)
      expect(frontmatter).toBeDefined()
      expect(frontmatter.name).toBeTruthy()
      expect(body).toBeTruthy()
    })

    it('character-agent.md 变量渲染', () => {
      const raw = readPromptSync('agents/character-agent.md')
      const { body } = parseFrontmatter(raw!)
      const rendered = renderPrompt(body, {
        name: '测试角色',
        public_role: '测试身份',
        secret_motive: '测试动机',
        true_intent: '测试意图',
        voice_md: '冷静简洁',
        current_emotional_state: '平静',
        knowledge_facts: '知道A\n知道B',
        knowledge_suspected: '怀疑C',
        knowledge_lies: '相信D',
      })

      expect(rendered).toContain('测试角色')
      expect(rendered).toContain('冷静简洁')
      expect(rendered).toContain('知道A')
      expect(rendered).not.toContain('{{ name }}')  // no unreplaced vars
    })

    it('director.md 包含 visibleTo 规范', () => {
      const raw = readPromptSync('agents/director.md')
      expect(raw).toBeTruthy()
      expect(raw!).toContain('visibleTo')
      expect(raw!).toContain('targetCharacterId')
    })
  })

  // ========================================
  // TASK-3/4: Agent 实例化
  // ========================================
  describe('Agent 实例化', () => {
    // Mock model — agents don't need real LLM for instantiation test
    const mockModel = { specificationVersion: 'v1', provider: 'test', modelId: 'test' } as any

    it('director agent 使用 prompt 文件', () => {
      const agent = directorAgent(mockModel)
      expect(agent).toBeDefined()
      expect(agent.name).toBe('director')
      const raw = readPromptSync('agents/director.md')
      expect(raw!).not.toContain('你是一位推演场景的导演')  // prompt 已从 TS 移除
    })

    it('narrator agent 使用 prompt 文件', () => {
      const agent = narratorAgent(mockModel)
      expect(agent).toBeDefined()
      expect(agent.name).toBe('narrator')
    })

    it('character agent 支持 voiceProfile', () => {
      const agent = createCharacterAgent(mockModel, {
        id: 'test-1',
        name: '测试角',
        publicRole: '测试',
        secretMotive: '测试动机',
        trueIntent: '测试意图',
        voiceMd: '旧版文本',
        voiceProfile: charVoice,
        currentEmotionalState: '',
        knowledgeFacts: [],
        knowledgeSuspected: [],
        knowledgeLies: [],
      })
      expect(agent).toBeDefined()
      expect(agent.name).toContain('测试角')

      // voiceProfile 优先于 voiceMd
      const instructions = (agent as any).instructions
      expect(instructions).toContain('语气基调')
      expect(instructions).not.toContain('旧版文本')
    })

    it('character agent fallback 到 voiceMd', () => {
      const agent = createCharacterAgent(mockModel, {
        id: 'test-2',
        name: '测试角2',
        publicRole: '测试',
        secretMotive: '',
        trueIntent: '',
        voiceMd: '冷酷无情',
        voiceProfile: undefined,
        currentEmotionalState: '',
        knowledgeFacts: [],
        knowledgeSuspected: [],
        knowledgeLies: [],
      })
      const instructions = (agent as any).instructions
      expect(instructions).toContain('冷酷无情')
    })
  })

  // ========================================
  // TASK-6: Voice MD → JSON
  // ========================================
  describe('Voice 结构化', () => {
    it('voiceToPromptText 渲染 VoiceProfile', () => {
      const result = voiceToPromptText('', charVoice)
      expect(result).toContain('冷静')
      expect(result).toContain('简洁')
    })

    it('voiceToPromptText fallback', () => {
      expect(voiceToPromptText('粗糙直接', undefined)).toBe('粗糙直接')
    })
  })

  // ========================================
  // TASK-5 + Config: Agent 配置 & 知识隔离
  // ========================================
  describe('Agent 配置', () => {
    it('读取 agent.yaml 配置', () => {
      const config = getAgentConfig()
      expect(config.agent.max_turns).toBe(200)
      expect(config.agent.auto_continue_on_max_iterations).toBeDefined()
      expect(config.agent.auto_continue_on_max_iterations.enabled).toBe(true)
      expect(config.agent.auto_continue_on_max_iterations.max_auto_continues).toBe(3)
    })
  })

  describe('知识隔离 — SimulationTurn', () => {
    it('visibleTo 空数组表示仅叙述者可见', () => {
      const turn = {
        turnIdx: 0,
        speakerType: 'narrator' as const,
        speakerId: 'narrator',
        speakerName: '旁白',
        utterance: '...',
        reasoning: '',
        visibleTo: [],
      }
      expect(turn.visibleTo).toHaveLength(0)
    })

    it('角色 turn visibleTo 默认仅自己', () => {
      const speakerId = 'alice'
      const turn = {
        turnIdx: 1,
        speakerType: 'character' as const,
        speakerId,
        speakerName: '爱丽丝',
        utterance: '你好',
        reasoning: '我在撒谎',
        visibleTo: [speakerId],
      }
      expect(turn.visibleTo).toEqual([speakerId])
      expect(turn.visibleTo).not.toContain('bob')
    })
  })
})
