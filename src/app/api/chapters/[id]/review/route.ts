// src/app/api/chapters/[id]/review/route.ts
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { chapters, chapterVersions, chapterOutlines, volumes, projects } from "@/db/schema"
import { eq } from "drizzle-orm"
import { runReviewWorkflow } from "@/mastra/workflows/review"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chapterId } = await params
  try {
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, chapterId))
    if (!chapter?.activeVersionId) {
      return NextResponse.json({ error: "章节不存在或无内容" }, { status: 404 })
    }
    const [version] = await db.select().from(chapterVersions)
      .where(eq(chapterVersions.id, chapter.activeVersionId))
    if (!version?.contentMd) {
      return NextResponse.json({ error: "章节内容为空" }, { status: 404 })
    }
    const [outline] = await db.select().from(chapterOutlines)
      .where(eq(chapterOutlines.id, chapter.chapterOutlineId))
    const [volume] = await db.select().from(volumes).where(eq(volumes.id, outline.volumeId))
    const [project] = await db.select().from(projects).where(eq(projects.id, volume.projectId))

    const result = await runReviewWorkflow({
      content: version.contentMd,
      projectId: project.id,
      chapterId,
      genre: project.genre,
      voiceCard: project.voiceMd ?? undefined,
      volumeThesis: volume.thesis ?? undefined,
    })

    return NextResponse.json(result)
  } catch (e) {
    console.error("[API] 审查失败:", e)
    return NextResponse.json({ error: "审查失败" }, { status: 500 })
  }
}
