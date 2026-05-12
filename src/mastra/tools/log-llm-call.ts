// mastra/tools/log-llm-call.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { llmCalls } from '@/db/schema'

export const logLlmCall = createTool({
  id: 'log-llm-call',
  description: '记录一次 LLM 调用到可观测日志',
  inputSchema: z.object({
    jobId: z.string(),
    model: z.string(),
    promptTokens: z.number(),
    completionTokens: z.number(),
    cost: z.number(),
    metadata: z.record(z.unknown()).optional(),
  }),
  execute: async ({ jobId, model, promptTokens, completionTokens, cost, metadata }) => {
    const [log] = await db.insert(llmCalls).values({
      jobId,
      model,
      promptTokens,
      completionTokens,
      cost,
      metadata: metadata || {},
    }).returning()
    return { id: log.id, cost: log.cost }
  },
})
