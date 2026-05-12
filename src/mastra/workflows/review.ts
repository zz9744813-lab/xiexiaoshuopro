// mastra/workflows/review.ts - 审查 Workflow
import { mastra } from '@/mastra'
import { detectSlop } from '@/lib/slop-detector'
import { z } from 'zod'

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

const IssueSchema = z.array(z.object({
  axis: z.string().optional(),
  severity: z.enum(['critical', 'warning', 'info']),
  title: z.string(),
  description: z.string().optional().default(''),
  evidence: z.string().optional().default(''),
  proposedFix: z.string().optional().default(''),
}))

const reviewerConfigs = [
  { name: 'logicReviewer',        label: 'logic-reviewer',        axis: 'logic' },
  { name: 'voiceReviewer',        label: 'voice-reviewer',        axis: 'voice' },
  { name: 'canonReviewer',        label: 'canon-reviewer',        axis: 'canon' },
  { name: 'pacingReviewer',       label: 'pacing-reviewer',       axis: 'pacing' },
  { name: 'themeReviewer',        label: 'theme-reviewer',        axis: 'theme' },
  { name: 'genreReviewer',        label: 'genre-reviewer',        axis: 'genre' },
  { name: 'readerSimulator',      label: 'reader-simulator',      axis: 'reader' },
  { name: 'slopReviewer',         label: 'slop-reviewer',         axis: 'aislop' },
  { name: 'volumeReviewer',       label: 'volume-reviewer',       axis: 'volume' },
  { name: 'continuityReviewer',   label: 'continuity-reviewer',   axis: 'continuity' },
  { name: 'relationshipReviewer', label: 'relationship-reviewer', axis: 'relationship' },
]

/**
 * 审查 Workflow — 所有 11 个 reviewer 并发
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

  // 2. 并发跑全部 11 个 LLM reviewer
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

        const m = text.match(/\[[\s\S]*\]/)
        const raw = m ? JSON.parse(m[0]) : []
        const parsed = IssueSchema.safeParse(raw)
        const parsedIssues = parsed.success ? parsed.data : []

        return { label, axis, issues: parsedIssues }
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
          title: issue.title,
          severity: issue.severity,
          axis: issue.axis || result.value.axis,
          description: issue.description,
          evidence: issue.evidence,
          proposedFix: issue.proposedFix,
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
