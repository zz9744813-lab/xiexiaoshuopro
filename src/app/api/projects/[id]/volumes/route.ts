// src/app/api/projects/[id]/volumes/route.ts
import { NextRequest, NextResponse } from "next/server"
import { mastra } from "@/mastra"
import { db } from "@/db"
import { projects, volumes } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const allVolumes = await db.select().from(volumes).where(eq(volumes.projectId, projectId))
  return NextResponse.json({ volumes: allVolumes })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params

  try {
    const body = await request.json()
    const { title, thesis, arcBeats } = body

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 })
    }

    const existing = await db
      .select({ n: volumes.volumeNum })
      .from(volumes)
      .where(eq(volumes.projectId, projectId))
    const nextNum = existing.length > 0
      ? Math.max(...existing.map(v => v.n)) + 1
      : 1

    const [created] = await db.insert(volumes).values({
      projectId,
      volumeNum: nextNum,
      title,
      thesis: thesis ?? '',
      arcBeats: arcBeats ?? [],
    }).returning()

    if (arcBeats) {
      const agent = mastra.getAgent("volumeOutline")
      const context = [
        `genre: ${project.genre}`,
        `volume_title: ${title}`,
        `volume_thesis: ${thesis || ""}`,
        `arc_beats: ${JSON.stringify(arcBeats, null, 2)}`,
      ].join("\n")

      try {
        const { text } = await agent.generate({
          messages: [{ role: "user", content: context }],
          runtimeContext: { projectId, volumeId: created.id },
        })
        return NextResponse.json({ volume: created, outline: text })
      } catch {
        return NextResponse.json({ volume: created })
      }
    }

    return NextResponse.json({ volume: created })
  } catch (error) {
    console.error("[API] 卷创建失败:", error)
    return NextResponse.json({ error: "卷创建失败" }, { status: 500 })
  }
}
