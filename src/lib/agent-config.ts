// lib/agent-config.ts — 读取 agent.json 运行时配置
import fs from 'fs'
import path from 'path'

interface AutoContinueConfig {
  enabled: boolean
  max_auto_continues: number
  prompt: string
}

interface AgentConfig {
  agent: {
    max_turns: number
    narrator_interval: number
    temperature: number
    character_temperature: number
    auto_continue_on_max_iterations: AutoContinueConfig
  }
}

const defaultConfig: AgentConfig = {
  agent: {
    max_turns: 200,
    narrator_interval: 3,
    temperature: 0.5,
    character_temperature: 0.9,
    auto_continue_on_max_iterations: {
      enabled: true,
      max_auto_continues: 3,
      prompt: [
        'Continue autonomously from the current state.',
        'Do not repeat completed work.',
        'Stop and summarize if blocked, if approval is required,',
        'or before destructive or externally visible actions.',
      ].join(' '),
    },
  },
}

export function getAgentConfig(): AgentConfig {
  try {
    const configPath = path.resolve(process.cwd(), 'config/agent.json')
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      return { ...defaultConfig, ...raw }
    }
    return defaultConfig
  } catch {
    return defaultConfig
  }
}
