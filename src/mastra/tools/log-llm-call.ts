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
    inputTokens: z.number(),
    outputTokens: z.number(),
    costUsd: z.number(),
    agentName: z.string().optional(),
    provider: z.string().optional(),
    durationMs: z.number().optional(),
    finishReason: z.string().optional(),
  }),
  execute: async ({ jobId, model, inputTokens, outputTokens, costUsd, agentName, provider, durationMs, finishReason }) => {
    const [log] = await db.insert(llmCalls).values({
      jobId,
      model,
      inputTokens,
      outputTokens,
      costUsd: String(costUsd),
      agentName,
      provider,
      durationMs,
      finishReason,
    }).returning()
    return { id: log.id, costUsd: log.costUsd }
  },
})
