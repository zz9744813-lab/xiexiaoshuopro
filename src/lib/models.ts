// lib/models.ts - LLM Provider 抽象层
import { createOpenAI } from '@ai-sdk/openai'

// DeepSeek (OpenAI 兼容协议)
const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
})

// Qwen (OpenAI 兼容协议)
const qwen = createOpenAI({
  apiKey: process.env.QWEN_API_KEY || '',
  baseURL: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
})

// 自部署 Qwen (兜底)
const selfHostedQwen = createOpenAI({
  apiKey: 'not-needed',
  baseURL: process.env.SELF_HOSTED_QWEN_URL || 'http://localhost:8000/v1',
})

// OpenRouter (应急通道)
const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || '',
  baseURL: 'https://openrouter.ai/api/v1',
})

// 模型实例（provider 只接受 modelId，temperature/maxTokens 在 streamText 时传）
export function deepseekChat() {
  return deepseek('deepseek-ai/DeepSeek-V3')
}

export function deepseekReasoner() {
  return deepseek('deepseek-ai/DeepSeek-R1')
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

// 路由策略：根据任务类型和安全级别选择模型 + 推荐参数
export type ModelTask = 'draft' | 'outline' | 'review' | 'summary' | 'simulation' | 'rewrite' | 'extract'

export interface ModelConfig {
  model: ReturnType<typeof deepseekChat>
  temperature: number
  maxTokens: number
}

export function getModelForTask(task: ModelTask, safetyLevel: string = 'normal'): ModelConfig {
  // unrestricted 模式优先用自部署
  if (safetyLevel === 'unrestricted') {
    if (process.env.SELF_HOSTED_QWEN_URL) {
      return { model: qwenSelfHosted(), temperature: task === 'draft' ? 0.85 : 0.7, maxTokens: 8000 }
    }
    if (process.env.OPENROUTER_API_KEY) {
      return { model: openrouterModel('meta-llama/llama-3.1-70b-instruct'), temperature: 0.85, maxTokens: 8000 }
    }
  }

  // 默认路由
  switch (task) {
    case 'draft':
      return { model: deepseekChat(), temperature: 0.85, maxTokens: 12000 }
    case 'outline':
      return { model: deepseekChat(), temperature: 0.7, maxTokens: 4000 }
    case 'review':
      return { model: deepseekChat(), temperature: 0.3, maxTokens: 3000 }
    case 'summary':
      return { model: deepseekChat(), temperature: 0.5, maxTokens: 2000 }
    case 'simulation':
      return { model: deepseekChat(), temperature: 0.9, maxTokens: 2000 }
    case 'rewrite':
      return { model: deepseekChat(), temperature: 0.75, maxTokens: 6000 }
    case 'extract':
      return { model: deepseekChat(), temperature: 0.3, maxTokens: 3000 }
    default:
      return { model: deepseekChat(), temperature: 0.7, maxTokens: 4000 }
  }
}
