// API: 生成章节正文 (流式) — Mastra Agent
import { NextRequest } from "next/server";
import { mastra } from "@/mastra";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chapterId } = await params;

  try {
    const body = await request.json();
    const {
      projectId, outline, previousSummary, characters,
      voiceCard, genre, safetyLevel, slopBlacklist, worldEvents,
    } = body;

    const agent = mastra.getAgent("chapterDraft");

    const contextLines = [
      `project_id: ${projectId}`,
      `chapter_id: ${chapterId}`,
      `genre: ${genre || ""}`,
      `chapter_outline: ${outline || ""}`,
      `prev_chapter_summary: ${previousSummary || ""}`,
      `characters_present: ${characters || ""}`,
      `voice_card: ${voiceCard || ""}`,
      `safety_level: ${safetyLevel || "standard"}`,
      `slop_blacklist: ${JSON.stringify(slopBlacklist || [])}`,
      `between_chapter_events: ${worldEvents || ""}`,
    ].join("\n");

    const result = await agent.stream({
      messages: [{ role: "user", content: contextLines }],
      runtimeContext: { projectId, chapterId },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[API] 章节生成失败:", error);
    return new Response(
      JSON.stringify({ error: "章节生成失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}