// mastra/workflows/bible-extraction.ts — Bible 抽取 Workflow
import { mastra } from '@/mastra'

export interface BibleExtractionInput {
  chapterContent: string
  chapterTitle: string
  projectId: string
  chapterNumber: number
}

export interface BibleExtractionResult {
  newCanonFacts: Array<{
    category: string         // "character", "location", "item", "event", "rule"
    fact: string
    confidence: number       // 0-1
    evidence: string
  }>
  worldEntries: Array<{
    title: string
    content: string
    tags: string[]
  }>
  updatedCharacters: Array<{
    name: string
    field: string
    oldValue?: string
    newValue: string
  }>
}

/**
 * Bible Extraction Workflow — 从新完成章节中抽取 canon facts
 * 每次章节定稿后运行，自动更新世界 Bible
 */
export async function runBibleExtraction(
  input: BibleExtractionInput
): Promise<BibleExtractionResult> {
  const agent = mastra.getAgent('bibleExtract')

  const prompt = [
    `## Bible 抽取任务`,
    `chapter_title: ${input.chapterTitle}`,
    `chapter_number: ${input.chapterNumber}`,
    `content: ${input.chapterContent.slice(0, 8000)}`,
    ``,
    `从以上章节中抽取：`,
    `1. new_canon_facts: 新确立的世界事实`,
    `2. world_entries: 新出现的地点、物品、组织、规则`,
    `3. updated_characters: 角色信息的更新（外貌、能力、关系变化）`,
  ].join('\n')

  const result = await agent.generate(prompt)

  try {
    const parsed = JSON.parse(result.text)
    return {
      newCanonFacts: parsed.new_canon_facts || [],
      worldEntries: parsed.world_entries || [],
      updatedCharacters: parsed.updated_characters || [],
    }
  } catch {
    return { newCanonFacts: [], worldEntries: [], updatedCharacters: [] }
  }
}
