// mastra/tools/get-chapter-context.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/db'
import { chapterOutlines, volumes, projects, characters, worldEntries } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'

export const getChapterContext = createTool({
  id: 'get-chapter-context',
  description: '获取章节的完整上下文信息',
  inputSchema: z.object({
    chapterOutlineId: z.string(),
  }),
  execute: async ({ chapterOutlineId }) => {
    // 获取章节大纲
    const [outline] = await db
      .select()
      .from(chapterOutlines)
      .where(eq(chapterOutlines.id, chapterOutlineId))

    if (!outline) {
      return { error: '章节不存在' }
    }

    // 获取卷册信息
    const [volume] = await db
      .select()
      .from(volumes)
      .where(eq(volumes.id, outline.volumeId))

    // 获取项目信息
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, volume.projectId))

    // 获取POV角色信息
    let povCharacter = null
    if (outline.povCharacterId) {
      const [char] = await db
        .select()
        .from(characters)
        .where(eq(characters.id, outline.povCharacterId))
      povCharacter = char
    }

    // 获取在场角色信息
    let presentCharacters: typeof characters.$inferSelect[] = []
    const charsPresent = outline.charactersPresent as string[] | undefined
    if (charsPresent && Array.isArray(charsPresent) && charsPresent.length > 0) {
      presentCharacters = await db
        .select()
        .from(characters)
        .where(eq(characters.projectId, volume.projectId))
        .then(chars => chars.filter(c => charsPresent.includes(c.id)))
    }

    return {
      outline: {
        id: outline.id,
        title: outline.title,
        chapterNum: outline.chapterNum,
        beatsMd: outline.beatsMd,
        targetWordCount: outline.targetWordCount,
        hookIntent: outline.hookIntent,
        status: outline.status,
      },
      volume: {
        id: volume.id,
        title: volume.title,
        volumeNum: volume.volumeNum,
        thesis: volume.thesis,
      },
      project: {
        id: project.id,
        title: project.title,
        genre: project.genre,
        genreConfig: project.genreConfig,
      },
      povCharacter: povCharacter ? {
        id: povCharacter.id,
        name: povCharacter.name,
        voiceMd: povCharacter.voiceMd,
        currentEmotionalState: povCharacter.currentEmotionalState,
      } : null,
      presentCharacters: presentCharacters.map(c => ({
        id: c.id,
        name: c.name,
        tier: c.tier,
        appearance: c.appearance,
      })),
    }
  },
})
