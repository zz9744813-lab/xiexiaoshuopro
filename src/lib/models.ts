// lib/models.ts - LLM Provider 抽象层
import { createOpenAI } from '@ai-sdk/openai'

// ─── 主力 Provider（DeepSeek via 环境变量） ───
const primaryProvider = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
})

// 模型 ID 从环境变量读取，默认 deepseek-v4-pro
const PRIMARY_MODEL = process.env.LLM_MODEL_ID || 'deepseek-chat'
const REASONER_MODEL = process.env.LLM_REASONER_MODEL_ID || 'deepseek-reasoner'

// ─── Qwen（备用） ───
const qwen = createOpenAI({
  apiKey: process.env.QWEN_API_KEY || '',
  baseURL: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
})

// ─── 自部署 Qwen（兜底 / unrestricted） ───
const selfHostedQwen = createOpenAI({
  apiKey: 'not-needed',
  baseURL: process.env.SELF_HOSTED_QWEN_URL || 'http://localhost:8000/v1',
})

// ─── OpenRouter（应急） ───
const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || '',
  baseURL: 'https://openrouter.ai/api/v1',
})

// ─── NVIDIA NIM（可选高性能 provider） ───
const nvidiaNim = createOpenAI({
  apiKey: process.env.NVIDIA_NIM_API_KEY || 'not-needed',
  baseURL: process.env.NVIDIA_NIM_BASE_URL || 'http://localhost:8000/v1',
})

// ─── 模型工厂函数 ───

export function deepseekChat() {
  return primaryProvider(PRIMARY_MODEL)
}

export function deepseekReasoner() {
  return primaryProvider(REASONER_MODEL)
}

export function qwenMax() {
  return qwen('qwen-max')
}

export function qwenSelfHosted() {
  return selfHostedQwen('qwen2.5-32b-instruct')
}

export function openrouterModel(model: string) {
  return openrouter(model)
}

export function nvidiaModel(model?: string) {
  const m = model || process.env.NVIDIA_NIM_MODEL || 'meta/llama-3.1-8b-instruct'
  return nvidiaNim(m)
}

// ─── 路由策略 ───

export type ModelTask =
  | 'draft'
  | 'outline'
  | 'review'
  | 'summary'
  | 'simulation'
  | 'rewrite'
  | 'extract'
  | 'analysis'

export interface ModelConfig {
  model: ReturnType<typeof deepseekChat>
  temperature: number
  maxTokens: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
}

export function getModelForTask(task: ModelTask, safetyLevel: string = 'normal'): ModelConfig {
  if (safetyLevel === 'unrestricted') {
    if (process.env.NVIDIA_NIM_BASE_URL && process.env.NVIDIA_NIM_MODEL) {
      return { model: nvidiaModel(), temperature: task === 'draft' ? 0.85 : 0.7, maxTokens: 8000 }
    }
    if (process.env.SELF_HOSTED_QWEN_URL) {
      return { model: qwenSelfHosted(), temperature: task === 'draft' ? 0.85 : 0.7, maxTokens: 8000 }
    }
    if (process.env.OPENROUTER_API_KEY) {
      return { model: openrouterModel('meta-llama/llama-3.1-70b-instruct'), temperature: 0.85, maxTokens: 8000 }
    }
  }

  const isReasoner = PRIMARY_MODEL.includes('v4-pro') || PRIMARY_MODEL.includes('reasoner')
  const reasonBudget = isReasoner ? 8000 : 0

  const configs: Record<string, ModelConfig> = {
    draft:     { model: deepseekChat(), temperature: 0.85, maxTokens: 12000 + reasonBudget, topP: 0.9 },
    outline:   { model: deepseekChat(), temperature: 0.7,  maxTokens: 4000  + reasonBudget },
    review:    { model: deepseekChat(), temperature: 0.3,  maxTokens: 4000,  topP: 0.85 },
    summary:   { model: deepseekChat(), temperature: 0.5,  maxTokens: 3000 },
    simulation:{ model: deepseekChat(), temperature: 0.9,  maxTokens: 4000  + reasonBudget },
    rewrite:   { model: deepseekChat(), temperature: 0.75, maxTokens: 6000  + reasonBudget },
    extract:   { model: deepseekChat(), temperature: 0.3,  maxTokens: 3000  + reasonBudget },
    analysis:  { model: deepseekChat(), temperature: 0.5,  maxTokens: 4000 },
  }

  return configs[task] || { model: deepseekChat(), temperature: 0.7, maxTokens: 4000 }
}