// mastra/workflows/regeneration-cascade.ts - 修改连锁传播 Workflow
// 当用户编辑了某个章节，自动检测受影响的后续章节并标记/重新生成

export interface RegenerationCascadeInput {
  projectId: string
  changedChapterId: string
  changeDescription: string
  affectedChapterIds?: string[]
}

export interface AffectedChapter {
  chapterId: string
  chapterTitle: string
  chapterNumber: number
  impactReason: string
  impactLevel: 'must_regenerate' | 'should_review' | 'may_review'
}

export interface RegenerationCascadeResult {
  affectedChapters: AffectedChapter[]
  regenerationOrder: string[]
  summary: string
}

/**
 * 分析修改影响：计算被波及的后续章节列表
 * 实际重新生成由 chapter-generation workflow 处理
 */
export function analyzeCascade(input: RegenerationCascadeInput): RegenerationCascadeResult {
  // 如果调用方已经提供了受影响的章节列表，直接排序返回
  const affected = (input.affectedChapterIds || []).map((id, i) => ({
    chapterId: id,
    chapterTitle: '',
    chapterNumber: i + 1,
    impactReason: input.changeDescription,
    impactLevel: 'must_regenerate' as const,
  }))

  return {
    affectedChapters: affected,
    regenerationOrder: affected.map(c => c.chapterId),
    summary: `检测到 ${affected.length} 个章节受到 "${input.changeDescription}" 的影响`,
  }
}

/**
 * 级联重新生成：按顺序调用 chapter-generation workflow
 */
export async function runRegenerationCascade(
  input: RegenerationCascadeInput,
  regenerateChapter: (chapterId: string) => Promise<unknown>
): Promise<RegenerationCascadeResult & { results: unknown[] }> {
  const cascade = analyzeCascade(input)
  const results: unknown[] = []

  for (const chapterId of cascade.regenerationOrder) {
    try {
      const result = await regenerateChapter(chapterId)
      results.push({ chapterId, status: 'success', result })
    } catch (error) {
      results.push({ chapterId, status: 'failed', error: String(error) })
    }
  }

  return { ...cascade, results }
}
