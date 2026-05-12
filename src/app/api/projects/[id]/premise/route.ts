// API: 生成命题候选 (流式)
import { NextRequest } from "next/server";
import { mastra } from "@/mastra";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return new Response(JSON.stringify({ error: "项目不存在" }), { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const seed = body.seed || project.authorNotes || "";

    const agent = mastra.getAgent("premise");

    const context = [
      `genre: ${project.genre}`,
      `seed: ${seed}`,
    ].join("\n");

    const result = await agent.stream({
      messages: [{ role: "user", content: context }],
      runtimeContext: { projectId },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("[API] 命题生成失败:", error);
    return new Response(
      JSON.stringify({ error: "命题生成失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}