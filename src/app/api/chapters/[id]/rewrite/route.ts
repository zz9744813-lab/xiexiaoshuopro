// API: 章节片段重写 — Mastra Agent
import { NextRequest } from "next/server";
import { mastra } from "@/mastra";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chapterId } = await params;
  try {
    const body = await request.json();
    const { projectId, section, instruction, context } = body;

    const agent = mastra.getAgent("sectionRewriter");

    const prompt = [
      `instruction: ${instruction}`,
      `context: ${context || ""}`,
      `section_to_rewrite:\n${section}`,
    ].join("\n");

    const result = await agent.stream({
      messages: [{ role: "user", content: prompt }],
      runtimeContext: { projectId, chapterId },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[API] 重写失败:", error);
    return new Response(
      JSON.stringify({ error: "重写失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}