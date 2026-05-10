// mastra/tools/get-genre-profile.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { readFileSync } from 'fs'
import { join } from 'path'

export const getGenreProfile = createTool({
  id: 'get-genre-profile',
  description: '获取类型配置文件',
  inputSchema: z.object({
    genre: z.string(),
  }),
  execute: async ({ genre }) => {
    try {
      const filePath = join(process.cwd(), 'prompts', 'genre_profiles', `${genre}.json`)
      const content = readFileSync(filePath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return {
        id: genre,
        name: genre,
        contract: { must_have: [], should_have: [], avoid: [] },
        pacing: {},
        voice_guidelines: {},
        world_building: {},
      }
    }
  },
})
