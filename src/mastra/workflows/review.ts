// mastra/workflows/review.ts - 审查 Workflow
import { mastra } from '@/mastra'
import { detectSlop } from '@/lib/slop-detector'
import { z } from 'zod'
import { db } from '@/db'
import { issues as issuesTable } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

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
  fixedContent: string | null
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

const FIXER_MAP: Record<string, string> = {
  canon: 'canonFixer',
  aislop: 'slopFixer',
  continuity: 'continuityFixer',
}

/**
 * 审查 Workflow — 所有 11 个 reviewer + auto-fix loop + issue 落库
 */
export async function runReviewWorkflow(input: ReviewInput): Promise<ReviewResult> {
  const issues: ReviewIssue[] = []
  const reviewersRun: string[] = []

  // 1. Slop 检测（本地）
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
          runtimeContext: { projectId: input.projectId, chapterId: input.chapterId },
        })

        const m = text.match(/\[[\s\S]*\]/)
        const raw = m ? JSON.parse(m[0]) : []
        const parsed = IssueSchema.safeParse(raw)
        return { label, axis, issues: parsed.success ? parsed.data : [] }
      } catch {
        return { label, axis, issues: [] }
      }
    })
  )

  // 3. 收集 issues + 自动修复
  let updatedContent = input.content
  const finalIssues: ReviewIssue[] = []

  // 先加 slop 结果
  for (const i of issues) {
    finalIssues.push(i)
  }

  for (const result of llmResults) {
    if (result.status !== 'fulfilled') continue
    reviewersRun.push(result.value.label)

    for (const issue of result.value.issues) {
      const ri: ReviewIssue = {
        title: issue.title,
        severity: issue.severity,
        axis: issue.axis || result.value.axis,
        description: issue.description,
        evidence: issue.evidence,
        proposedFix: issue.proposedFix,
        reviewerAgent: result.value.label,
      }

      // Auto-fix critical issues
      if (issue.severity === 'critical' && FIXER_MAP[ri.axis]) {
        let fixed = false
        const fixerAgent = mastra.getAgent(FIXER_MAP[ri.axis])

        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const { text: fixText } = await fixerAgent.generate({
              messages: [{
                role: 'user',
                content: [
                  `## 待修复 issue`,
                  `axis: ${ri.axis}`,
                  `description: ${ri.description}`,
                  `evidence: ${ri.evidence}`,
                  `proposed_fix: ${ri.proposedFix}`,
                  ``,
                  `## 当前章节内容`,
                  updatedContent,
                  ``,
                  `请直接输出修复后的完整章节 markdown，不要解释。`,
                ].join('\n'),
              }],
              runtimeContext: { projectId: input.projectId, chapterId: input.chapterId },
            })

            const lenRatio = fixText.length / updatedContent.length
            if (lenRatio > 0.7 && lenRatio < 1.3) {
              updatedContent = fixText
              finalIssues.push({ ...ri, severity: 'info' })
              fixed = true
              break
            }
          } catch { /* 重试 */ }
        }

        if (!fixed) {
          finalIssues.push({ ...ri, severity: 'warning' })
        }
      } else {
        finalIssues.push(ri)
      }
    }
  }

  // 4. Issue 落库
  for (const i of finalIssues) {
    try {
      const existing = await db.select({ id: issuesTable.id })
        .from(issuesTable)
        .where(and(
          eq(issuesTable.projectId, input.projectId),
          eq(issuesTable.scopeId, input.chapterId),
          eq(issuesTable.axis, i.axis),
          eq(issuesTable.title, i.title),
        ))
      if (existing.length > 0) continue

      await db.insert(issuesTable).values({
        projectId: input.projectId,
        scope: 'chapter',
        scopeId: input.chapterId,
        axis: i.axis,
        severity: i.severity,
        title: i.title,
        description: i.description,
        evidence: i.evidence,
        proposedFix: i.proposedFix,
        reviewerAgent: i.reviewerAgent,
        status: 'open',
      })
    } catch { /* 落库失败不阻塞 */ }
  }

  return {
    issues: finalIssues,
    fixedContent: updatedContent !== input.content ? updatedContent : null,
    slopHits: slopHits.length,
    slopRate: input.content.length > 0
      ? (slopHits.length / input.content.length * 100).toFixed(3) + '%'
      : '0%',
    reviewersRun,
  }
}
