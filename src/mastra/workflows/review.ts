// mastra/workflows/review.ts - 审查 Workflow
import { mastra } from '@/mastra'
import { getModelForTask } from '@/lib/models'
import { detectSlop } from '@/lib/slop-detector'

export interface ReviewInput {
  content: string
  projectId: string
  chapterId: string
  genre?: string
  voiceCard?: string
  canonFacts?: string[]
  volumeThesis?: string
}

export interface ReviewIssue {
  title: string
  severity: 'critical' | 'warning' | 'info'
  axis: string
  description: string
  evidence: string
  proposedFix: string
  reviewerAgent: string
}

export interface ReviewResult {
  issues: ReviewIssue[]
  slopHits: number
  slopRate: string
  reviewersRun: string[]
}

/**
 * 审查 Workflow - 并发跑多个 reviewer
 */
export async function runReviewWorkflow(input: ReviewInput): Promise<ReviewResult> {
  const issues: ReviewIssue[] = []
  const reviewersRun: string[] = []

  // 1. Slop 检测（本地，不需要 LLM）
  const slopHits = detectSlop(input.content)
  reviewersRun.push('slop-detector')

  if (slopHits.length > 0) {
    const grouped = new Map<string, typeof slopHits>()
    for (const hit of slopHits) {
      const existing = grouped.get(hit.category) || []
      existing.push(hit)
      grouped.set(hit.category, existing)
    }
    for (const [category, hits] of grouped) {
      issues.push({
        title: `AI 味表达 (${category}): ${hits.length} 处`,
        severity: hits.length >= 5 ? 'critical' : 'warning',
        axis: 'aislop',
        description: `检测到 ${hits.length} 处 ${category} 类型的 AI 味表达`,
        evidence: hits.slice(0, 3).map(h => `"${h.context}"`).join('\n'),
        proposedFix: hits[0].replacement,
        reviewerAgent: 'slop-detector',
      })
    }
  }

  // 2. LLM 审查（逻辑 + 设定）
  const logicReviewerAgent = mastra.getAgent('logicReviewer')

  try {
    const { text } = await logicReviewerAgent.generate(
      `你是一位小说审稿编辑。检查以下章节的逻辑一致性和质量问题。

${input.canonFacts ? `## 已确立的设定\n${input.canonFacts.join('\n')}\n` : ''}
${input.volumeThesis ? `## 卷命题\n${input.volumeThesis}\n` : ''}

## 章节内容
${input.content.slice(0, 6000)}

## 检查项
1. 逻辑因果是否成立
2. 是否与已确立设定矛盾
3. 节奏是否合理
4. 章末钩子是否有效

输出 JSON 数组，每个 issue：
[{"title":"问题","severity":"critical|warning|info","axis":"logic|canon|pacing","description":"描述","evidence":"引用","proposedFix":"建议"}]

如果没有问题输出 []。直接输出JSON。`
    )

    reviewersRun.push('logic-canon-pacing-reviewer')

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      for (const issue of parsed) {
        issues.push({
          ...issue,
          reviewerAgent: 'logic-canon-pacing-reviewer',
        })
      }
    }
  } catch {
    // LLM 审查失败不阻塞
  }

  return {
    issues,
    slopHits: slopHits.length,
    slopRate: input.content.length > 0
      ? (slopHits.length / input.content.length * 100).toFixed(3) + '%'
      : '0%',
    reviewersRun,
  }
}
