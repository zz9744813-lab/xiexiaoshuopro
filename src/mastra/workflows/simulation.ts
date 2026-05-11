// mastra/workflows/simulation.ts - 推演 Workflow（修复知识隔离）
import { mastra } from '@/mastra'
import { getModelForTask } from '@/lib/models'

export interface SimulationInput {
  projectId: string
  directorGoal: string
  characters: Array<{
    id: string
    name: string
    publicRole: string
    secretMotive: string
    voiceMd: string
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
  visibleTo: string[] // 哪些角色能看到这条 turn
}

export interface SimulationResult {
  turns: SimulationTurn[]
  scriptMd: string
  turnCount: number
}

/**
 * 推演 Workflow - 多轮 turn-by-turn 循环（带知识隔离）
 */
export async function runSimulationWorkflow(input: SimulationInput): Promise<SimulationResult> {
  const turns: SimulationTurn[] = []
  const { model, temperature, maxTokens } = getModelForTask('simulation')

  const characterDescriptions = input.characters
    .map(c => `- ${c.name}（${c.publicRole}）`)
    .join('\n')

  for (let turnIdx = 0; turnIdx < input.maxTurns; turnIdx++) {
    // Director 只看 utterance（公开信息），不看 reasoning
    const publicHistory = turns
      .map(t => `[${t.speakerName}]: ${t.utterance}`)
      .join('\n')

    // Director 决策
    const directorAgent = mastra.getAgent('director')
    const { text: directorResponse } = await directorAgent.generate({
      messages: [{
        role: "user",
        content: `你是推演导演。场景目标：${input.directorGoal}

参与角色：
${characterDescriptions}

已发生（公开行为）：
${publicHistory || '（刚开始）'}

决定下一步。输出JSON：
{"action":"speak|end","targetName":"角色名","reason":"理由"}

如果场景目标已达成或对话自然结束，action 为 "end"。`
      }],
    })

    let directorDecision
    try {
      const match = directorResponse.match(/\{[\s\S]*\}/)
      directorDecision = match ? JSON.parse(match[0]) : { action: 'end', reason: '无法解析' }
    } catch {
      directorDecision = { action: 'end', reason: '解析失败' }
    }

    if (directorDecision.action === 'end') break

    // 找到目标角色
    const speakingChar = input.characters.find(c => c.name === directorDecision.targetName)
      || input.characters[turnIdx % input.characters.length]

    // ===== 知识隔离：角色只能看到 visibleTo 包含自己的 turns =====
    const visibleTurns = turns.filter(t => t.visibleTo.includes(speakingChar.id))
    const characterVisibleHistory = visibleTurns
      .map(t => `[${t.speakerName}]: ${t.utterance}`) // 只看 utterance，不看 reasoning
      .join('\n')

    // 角色发言（只注入自己的私密信息 + 可见的历史）
    const characterAgent = mastra.getAgent('characterAgent')
    const { text: characterResponse } = await characterAgent.generate({
      messages: [{
        role: "user",
        content: `你是「${speakingChar.name}」，${speakingChar.publicRole}。
秘密动机：${speakingChar.secretMotive}
声音：${speakingChar.voiceMd || '自然'}
你知道的事：${speakingChar.knowledgeFacts.join('；') || '无特殊'}

你能看到的场景（其他角色的内心你不知道）：
${characterVisibleHistory || '（刚开始）'}

以你的身份回应。输出JSON：
{"utterance":"你说的话或动作","reasoning":"内心想法（其他角色看不到）"}`
      }],
    })

    let charOutput
    try {
      const match = characterResponse.match(/\{[\s\S]*\}/)
      charOutput = match ? JSON.parse(match[0]) : { utterance: characterResponse, reasoning: '' }
    } catch {
      charOutput = { utterance: characterResponse.slice(0, 200), reasoning: '' }
    }

    // utterance 对所有人可见，reasoning 只对自己可见
    turns.push({
      turnIdx,
      speakerType: 'character',
      speakerId: speakingChar.id,
      speakerName: speakingChar.name,
      utterance: charOutput.utterance,
      reasoning: charOutput.reasoning, // 存储但不暴露给其他角色
      visibleTo: input.characters.map(c => c.id), // utterance 对所有人可见
    })
  }

  // 生成剧本 markdown（不含 reasoning）
  const scriptMd = turns
    .map(t => `**${t.speakerName}**：${t.utterance}`)
    .join('\n\n')

  return { turns, scriptMd, turnCount: turns.length }
}
