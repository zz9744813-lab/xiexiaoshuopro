// lib/env.ts - 环境变量验证（Zod）
import { z } from 'zod'

const envSchema = z.object({
  // 数据库
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // LLM
  DEEPSEEK_API_KEY: z.string().min(1, 'DEEPSEEK_API_KEY is required'),
  DEEPSEEK_BASE_URL: z.string().url().default('https://api.deepseek.com/v1'),
  LLM_MODEL_ID: z.string().default('deepseek-chat'),
  LLM_REASONER_MODEL_ID: z.string().optional(),

  // 备用 LLM（可选）
  QWEN_API_KEY: z.string().optional(),
  QWEN_BASE_URL: z.string().url().optional(),
  SELF_HOSTED_QWEN_URL: z.string().url().optional(),
  OPENROUTER_API_KEY: z.string().optional(),

  // 应用
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  SAFETY_DEFAULT_LEVEL: z.enum(['normal', 'strict', 'unrestricted']).default('normal'),
  COST_BUDGET_MONTHLY_USD: z.coerce.number().positive().default(50),

  // Node
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type Env = z.infer<typeof envSchema>

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    console.error(`❌ Environment validation failed:\n${formatted}`)
    // 开发环境不崩溃，只警告
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Invalid environment variables')
    }
    // 非生产环境返回带默认值的 partial
    return envSchema.parse({
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || 'postgres://localhost:5432/xiexiaoshuo',
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || 'missing',
    })
  }
  return result.data
}

export const env = validateEnv()
