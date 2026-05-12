// mastra/workflows/simulation.ts - 推演 Workflow（修复知识隔离）
import { mastra } from '@/mastra'
import { createCharacterAgent } from '@/mastra/agents/character-agent'
import { getModelForTask } from '@/lib/models'

const { model: simulatorModel } = getModelForTask('simulator')

export interface SimulationInput {
  projectId: string
  directorGoal: string
  characters: Array<{
    id: string
    name: string
    publicRole: string
    secretMotive: string
    voiceMd: string
    voiceProfile?: import('@/types/voice').VoiceProfile
    knowledgeFacts: string[]
  }>
  maxTurns: number
  povChoice?: string
}

export interface SimulationTurn {
  turnIdx: number
  speakerType: 'director' | 'character' | 'narrator' | 'injection'
  speakerId: string
  speakerName: string
  utterance: string
  reasoning: string
  visibleTo: string[]
}

export interface SimulationResult {
  turns: SimulationTurn[]
  scriptMd: string
  turnCount: number
}

/**
 * 推演 Workflow - 多轮 turn-by-turn 循环（带知识隔离）
 * Director → Mastra director agent
 * Narrator → Mastra narrator agent
 * Character → Mastra character agent（动态实例化，知识隔离）
 */
export async function runSimulationWorkflow(input: SimulationInput): Promise<SimulationResult> {
  const turns: SimulationTurn[] = []

  const characterDescriptions = input.characters
    .map(c => `- ${c.name}（${c.publicRole}）`)
    .join('\n')

  const runtimeCtx = { projectId: input.projectId }

  for (let turnIdx = 0; turnIdx < input.maxTurns; turnIdx++) {
    // Director 只看 utterance（公开信息），不看 reasoning
    const publicHistory = turns
      .map(t => `[${t.speakerName}]: ${t.utterance}`)
      .join('\n')

    // Director 决策 — 使用 Mastra agent
    const directorAgent = mastra.getAgent('director')
    let directorDecision: { action: string; reason: string; targetName?: string; targetCharacterId?: string; visibleTo?: string[]; injectionText?: string; endReason?: string }
    try {
      const { text: directorResponse } = await directorAgent.generate({
        messages: [{
          role: 'user',
          content: [
            `director_goal: ${input.directorGoal}`,
            `characters: ${characterDescriptions}`,
            `history:\n${publicHistory || '（刚开始）'}`,
          ].join('\n'),
        }],
        runtimeContext: runtimeCtx,
      })

      const match = directorResponse.match(/\{[\s\S]*\}/)
      directorDecision = match ? JSON.parse(match[0]) : { action: 'end', reason: '无法解析' }
    } catch {
      directorDecision = { action: 'end', reason: '解析失败' }
    }

    if (directorDecision.action === 'end') break

    // 找到目标角色
    const targetId = directorDecision.targetCharacterId || directorDecision.targetName
    const speakingChar = input.characters.find(c => c.id === targetId || c.name === targetId)
      || input.characters[turnIdx % input.characters.length]

    // ===== 知识隔离：角色只能看到 visibleTo 包含自己的 turns =====
    const visibleTurns = turns.filter(t => t.visibleTo.includes(speakingChar.id))
    const characterVisibleHistory = visibleTurns
      .map(t => `[${t.speakerName}]: ${t.utterance}`)
      .join('\n')

    // 角色发言 — 动态创建角色 Agent 实例（知识隔离，simulator model 注入）
    const characterAgent = createCharacterAgent(
      simulatorModel,
      {
        id: speakingChar.id,
        name: speakingChar.name,
        publicRole: speakingChar.publicRole,
        secretMotive: speakingChar.secretMotive,
        trueIntent: speakingChar.secretMotive, // 复用 secretMotive
        voiceMd: speakingChar.voiceMd || '自然',
        voiceProfile: speakingChar.voiceProfile,
        currentEmotionalState: '',
        knowledgeFacts: speakingChar.knowledgeFacts || [],
        knowledgeSuspected: [],
        knowledgeLies: [],
      }
    )
    let charOutput: { utterance: string; reasoning: string }
    try {
      const { text: characterResponse } = await characterAgent.generate({
        messages: [{
          role: 'user',
          content: [
            `character_name: ${speakingChar.name}`,
            `public_role: ${speakingChar.publicRole}`,
            `secret_motive: ${speakingChar.secretMotive}`,
            `voice: ${speakingChar.voiceMd || '自然'}`,
            `knowledge_facts: ${speakingChar.knowledgeFacts.join('；') || '无特殊'}`,
            `visible_history:\n${characterVisibleHistory || '（刚开始）'}`,
          ].join('\n'),
        }],
        runtimeContext: runtimeCtx,
      })

      const match = characterResponse.match(/\{[\s\S]*\}/)
      charOutput = match ? JSON.parse(match[0]) : { utterance: characterResponse, reasoning: '' }
    } catch {
      charOutput = { utterance: '(无法发言)', reasoning: '' }
    }

    // 是否需要旁白 — 使用 Mastra narrator agent
    if (turnIdx === 0 || turnIdx % 3 === 0) {
      const narratorAgent = mastra.getAgent('narrator')
      try {
        const { text: narration } = await narratorAgent.generate({
          messages: [{
            role: 'user',
            content: `scene_context: ${publicHistory.slice(0, 500)}\ndirector_goal: ${input.directorGoal}`,
          }],
          runtimeContext: runtimeCtx,
        })

        turns.push({
          turnIdx: turnIdx + 0.5, // fractional idx for narrator
          speakerType: 'narrator',
          speakerId: 'narrator',
          speakerName: '旁白',
          utterance: narration.slice(0, 300),
          reasoning: '',
          visibleTo: [], // narrator is invisible to characters
        })
      } catch {
        // narration 失败不阻塞
      }
    }

    // utterance 对所有人可见，reasoning 只对自己可见
    turns.push({
      turnIdx,
      speakerType: 'character',
      speakerId: speakingChar.id,
      speakerName: speakingChar.name,
      utterance: charOutput.utterance,
      reasoning: charOutput.reasoning,
      // 知识隔离：visibleTo 由 Director 决策控制，fallback 仅发言人自己可见
      visibleTo: directorDecision.visibleTo || [speakingChar.id],
    })
  }

  // 生成剧本 markdown（不含 reasoning）
  const scriptMd = turns
    .map(t => `**${t.speakerName}**：${t.utterance}`)
    .join('\n\n')

  return { turns, scriptMd, turnCount: turns.length }
}
