// API: 生成章节细纲
import { NextRequest } from "next/server";
import { mastra } from "@/mastra";
import { db } from "@/db";
import { projects, volumes } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const body = await request.json();
    const { volumeId, arcBeats, chapterCount } = body;

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return new Response(JSON.stringify({ error: "项目不存在" }), { status: 404 });
    }

    let volumeThesis = "";
    if (volumeId) {
      const [volume] = await db
        .select()
        .from(volumes)
        .where(eq(volumes.id, volumeId));
      if (volume) {
        volumeThesis = volume.thesis || "";
      }
    }

    const agent = mastra.getAgent("chapterOutline");

    const context = [
      `genre: ${project.genre}`,
      `volume_thesis: ${volumeThesis || "未设定"}`,
      `arc_beats: ${JSON.stringify(arcBeats || [], null, 2)}`,
      `chapter_count: ${chapterCount || 10}`,
    ].join("\n");

    const result = await agent.stream({
      messages: [{ role: "user", content: context }],
      runtimeContext: { projectId, volumeId },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[API] 章节细纲生成失败:", error);
    return new Response(
      JSON.stringify({ error: "章节细纲生成失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}