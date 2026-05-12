// src/app/api/chapters/[id]/finalize/route.ts
import { NextRequest, NextResponse } from "next/server"
import { mastra } from "@/mastra"
import { db } from "@/db"
import {
  chapters, chapterVersions, chapterOutlines, volumes, projects, canonFacts,
} from "@/db/schema"
import { eq } from "drizzle-orm"
import { runReviewWorkflow } from "@/mastra/workflows/review"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chapterId } = await params

  try {
    // 1. 从 chapters -> outlines -> volumes -> projects 链拿全 context
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, chapterId))
    if (!chapter) return NextResponse.json({ error: "章节不存在" }, { status: 404 })

    const [outline] = await db.select().from(chapterOutlines)
      .where(eq(chapterOutlines.id, chapter.chapterOutlineId))
    if (!outline) return NextResponse.json({ error: "outline 不存在" }, { status: 404 })

    const [volume] = await db.select().from(volumes).where(eq(volumes.id, outline.volumeId))
    if (!volume) return NextResponse.json({ error: "volume 不存在" }, { status: 404 })

    const [project] = await db.select().from(projects).where(eq(projects.id, volume.projectId))
    if (!project) return NextResponse.json({ error: "project 不存在" }, { status: 404 })

    const projectId = project.id

    // 2. 拿 active version 内容
    if (!chapter.activeVersionId) {
      return NextResponse.json({ error: "无草稿内容" }, { status: 404 })
    }
    const [version] = await db.select().from(chapterVersions)
      .where(eq(chapterVersions.id, chapter.activeVersionId))
    if (!version?.contentMd) {
      return NextResponse.json({ error: "草稿为空" }, { status: 404 })
    }

    const content = version.contentMd

    // 3. 审查（同步等结果）
    const reviewResult = await runReviewWorkflow({
      content,
      projectId,
      chapterId,
      genre: project.genre,
      voiceCard: project.voiceMd ?? undefined,
      volumeThesis: volume.thesis ?? undefined,
    })

    // 4. 摘要（失败不阻塞）
    let summary
    try {
      const sumAgent = mastra.getAgent("chapterSummary")
      const { text } = await sumAgent.generate({
        messages: [{
          role: "user",
          content: `请为以下章节生成结构化摘要。\n\n${content.slice(0, 6000)}`,
        }],
        runtimeContext: { projectId, chapterId },
      })
      const m = text.match(/\{[\s\S]*\}/)
      if (m) summary = JSON.parse(m[0])
    } catch { /* ignore */ }

    // 5. Bible 抽取（异步触发，不等结果）
    //    依赖 TASK-E2 真实现 runBibleExtraction
    import("@/mastra/workflows/bible-extraction").then(({ runBibleExtraction }) =>
      runBibleExtraction({
        chapterContent: content,
        chapterTitle: outline.title,
        projectId,
        chapterId,
        chapterNumber: outline.chapterNum,
      }).catch(err => console.error("[bible-extract async]", err))
    )

    // 6. 推进世界时钟（异步触发，依赖 TASK-E1）
    import("@/mastra/workflows/world-tick").then(({ runWorldTick }) =>
      runWorldTick({
        projectId,
        chapterId,
        content,
      }).catch(err => console.error("[world-tick async]", err))
    )

    // 7. 标记章节为 finalized
    await db.update(chapters).set({
      status: "finalized",
      finalizedAt: new Date(),
      finalizedWordCount: content.length,
    }).where(eq(chapters.id, chapterId))

    return NextResponse.json({ success: true, review: reviewResult, summary })
  } catch (error) {
    console.error("[API] 定稿失败:", error)
    return NextResponse.json({ error: "定稿失败" }, { status: 500 })
  }
}
