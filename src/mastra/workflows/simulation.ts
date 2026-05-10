// mastra/workflows/simulation.ts - 推演 Workflow
import { generateText } from 'ai'
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
  visibleTo: string[]
}

export interface SimulationResult {
  turns: SimulationTurn[]
  scriptMd: string
  turnCount: number
}

/**
 * 推演 Workflow - 多轮 turn-by-turn 循环
 */
export async function runSimulationWorkflow(input: SimulationInput): Promise<SimulationResult> {
  const turns: SimulationTurn[] = []
  const { model, temperature, maxTokens } = getModelForTask('simulation')

  const characterDescriptions = input.characters
    .map(c => `- ${c.name}（${c.publicRole}）`)
    .join('\n')

  // 推演循环
  for (let turnIdx = 0; turnIdx < input.maxTurns; turnIdx++) {
    // Director 决策：谁说话
    const turnHistory = turns.map(t =>
      `[${t.speakerName}]: ${t.utterance}`
    ).join('\n')

    const { text: directorResponse } = await generateText({
      model,
      temperature: 0.7,
      maxOutputTokens: 500,
      prompt: `你是推演导演。场景目标：${input.directorGoal}

参与角色：
${characterDescriptions}

已发生：
${turnHistory || '（刚开始）'}

决定下一步。输出JSON：
{"action":"speak|end","targetName":"角色名","reason":"理由"}

如果场景目标已达成或对话自然结束，action 为 "end"。`,
    })

    let directorDecision
    try {
      const match = directorResponse.match(/\{[\s\S]*\}/)
      directorDecision = match ? JSON.parse(match[0]) : { action: 'end', reason: '无法解析' }
    } catch {
      directorDecision = { action: 'end', reason: '解析失败' }
    }

    if (directorDecision.action === 'end') {
      break
    }

    // 找到目标角色
    const targetChar = input.characters.find(c => c.name === directorDecision.targetName)
    if (!targetChar) {
      // 如果找不到角色，随机选一个
      const randomChar = input.characters[turnIdx % input.characters.length]
      directorDecision.targetName = randomChar.name
    }

    const speakingChar = input.characters.find(c => c.name === directorDecision.targetName) || input.characters[0]

    // 角色发言
    const { text: characterResponse } = await generateText({
      model,
      temperature: 0.9,
      maxOutputTokens: maxTokens,
      prompt: `你是「${speakingChar.name}」，${speakingChar.publicRole}。
秘密动机：${speakingChar.secretMotive}
声音：${speakingChar.voiceMd || '自然'}
你知道的事：${speakingChar.knowledgeFacts.join('；') || '无特殊'}

场景中已发生：
${turnHistory || '（刚开始）'}

以你的身份回应。输出JSON：
{"utterance":"你说的话或动作","reasoning":"内心想法"}`,
    })

    let charOutput
    try {
      const match = characterResponse.match(/\{[\s\S]*\}/)
      charOutput = match ? JSON.parse(match[0]) : { utterance: characterResponse, reasoning: '' }
    } catch {
      charOutput = { utterance: characterResponse.slice(0, 200), reasoning: '' }
    }

    turns.push({
      turnIdx,
      speakerType: 'character',
      speakerId: speakingChar.id,
      speakerName: speakingChar.name,
      utterance: charOutput.utterance,
      reasoning: charOutput.reasoning,
      visibleTo: input.characters.map(c => c.id),
    })
  }

  // 生成剧本 markdown
  const scriptMd = turns
    .map(t => `**${t.speakerName}**：${t.utterance}`)
    .join('\n\n')

  return {
    turns,
    scriptMd,
    turnCount: turns.length,
  }
}
