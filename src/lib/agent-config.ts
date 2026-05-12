// lib/agent-config.ts — 读取 agent.yaml 运行时配置
import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

interface AgentConfig {
  agent: {
    max_turns: number
    narrator_interval: number
    temperature: number
    character_temperature: number
  }
}

const defaultConfig: AgentConfig = {
  agent: {
    max_turns: 200,
    narrator_interval: 3,
    temperature: 0.5,
    character_temperature: 0.9,
  },
}

let cached: AgentConfig | null = null

export function getAgentConfig(): AgentConfig {
  if (cached) return cached

  try {
    const configPath = path.join(process.cwd(), 'config', 'agent.yaml')
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed = yaml.load(raw) as Partial<AgentConfig>
    cached = { ...defaultConfig, ...parsed } as AgentConfig
  } catch {
    cached = defaultConfig
  }

  return cached
}

export function getDefaultMaxTurns(): number {
  return getAgentConfig().agent.max_turns
}
