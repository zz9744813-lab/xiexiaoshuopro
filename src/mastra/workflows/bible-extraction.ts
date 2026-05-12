// mastra/workflows/bible-extraction.ts - Bible 提取 Workflow
// 从新章节中自动提取 canon facts 和 world building 内容
import { mastra } from '@/mastra'

export interface BibleExtractionInput {
  projectId: string
  chapterId: string
  contentMd: string
  chapterNumber?: number
}

export interface CanonFact {
  fact: string
  category: 'character' | 'world' | 'plot' | 'rule' | 'timeline'
  confidence: number
  sourceChapterId: string
}

export interface WorldEntry {
  title: string
  contentMd: string
  tags: string[]
}

export interface BibleExtractionResult {
  canonFacts: CanonFact[]
  worldEntries: WorldEntry[]
  characterUpdates: Array<{
    characterId: string
    field: string
    value: string
  }>
}

export async function runBibleExtraction(input: BibleExtractionInput): Promise<BibleExtractionResult> {
  const agent = mastra.getAgent('bibleExtract')

  const prompt = [
    `project_id: ${input.projectId}`,
    `chapter_id: ${input.chapterId}`,
    `chapter_number: ${input.chapterNumber || ''}`,
    '',
    '请从以下章节中提取所有值得记录的世界设定和 canon facts：',
    '',
    '--- 章节正文 ---',
    input.contentMd.slice(0, 8000),
    '---',
    '',
    '提取规则：',
    '1. 新出现的世界规则或设定',
    '2. 角色背景的补充信息',
    '3. 时间线关键节点',
    '4. 地理/环境的新信息',
    '5. 物品/能力的新设定',
    '',
    '输出 JSON: { "canonFacts": [...], "worldEntries": [...], "characterUpdates": [...] }',
  ].join('\n')

  const result = await agent.generate({
    messages: [{ role: 'user', content: prompt }],
    runtimeContext: { projectId: input.projectId, chapterId: input.chapterId },
  })

  try {
    return JSON.parse(result.text)
  } catch {
    return { canonFacts: [], worldEntries: [], characterUpdates: [] }
  }
}
