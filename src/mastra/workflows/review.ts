// mastra/workflows/review.ts - 审查 Workflow
import { mastra } from '@/mastra'
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
 * 审查 Workflow — 通过 Mastra agent 并发跑多个 reviewer
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

  // 2. 并发跑 LLM 审查（每个 reviewer 独立 agent）
  const reviewerConfigs = [
    { name: 'logicReviewer', label: 'logic-reviewer', axis: 'logic' },
    { name: 'canonReviewer', label: 'canon-reviewer', axis: 'canon' },
    { name: 'pacingReviewer', label: 'pacing-reviewer', axis: 'pacing' },
  ]

  const contextLine = [
    input.canonFacts ? `canon_facts: ${input.canonFacts.join('|')}` : '',
    input.volumeThesis ? `volume_thesis: ${input.volumeThesis}` : '',
    input.genre ? `genre: ${input.genre}` : '',
  ].filter(Boolean).join('\n')

  const llmResults = await Promise.allSettled(
    reviewerConfigs.map(async ({ name, label, axis }) => {
      try {
        const agent = mastra.getAgent(name)
        const { text } = await agent.generate({
          messages: [{
            role: 'user',
            content: `${contextLine}\n\nchapter_content:\n${input.content.slice(0, 6000)}`,
          }],
          runtimeContext: {
            projectId: input.projectId,
            chapterId: input.chapterId,
          },
        })

        const jsonMatch = text.match(/\[[\s\S]*\]/)
        const parsed: ReviewIssue[] = jsonMatch ? JSON.parse(jsonMatch[0]) : []

        return { label, axis, issues: parsed }
      } catch {
        return { label, axis, issues: [] }
      }
    })
  )

  for (const result of llmResults) {
    if (result.status === 'fulfilled') {
      reviewersRun.push(result.value.label)
      for (const issue of result.value.issues) {
        issues.push({
          ...issue,
          axis: issue.axis || result.value.axis,
          reviewerAgent: result.value.label,
        })
      }
    }
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