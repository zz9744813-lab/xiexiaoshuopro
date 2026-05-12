// src/mastra/tools/get-style-fingerprint.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const getStyleFingerprint = createTool({
  id: 'get-style-fingerprint',
  description: '获取文风指纹',
  inputSchema: z.object({
    projectId: z.string(),
  }),
  execute: async ({ projectId }) => {
    // TODO: query style fingerprint
    return { projectId, fingerprint: {} }
  },
})
