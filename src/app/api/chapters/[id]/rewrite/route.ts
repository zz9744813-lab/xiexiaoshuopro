// API: 段落重写 (流式) — 通过 Mastra Agent 调用
import { NextRequest } from "next/server";
import { mastra } from "@/mastra";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chapterId } = await params;

  try {
    const body = await request.json();
    const { selectedText, reason, contextBefore, contextAfter, voiceCard } = body;

    if (!selectedText) {
      return new Response(
        JSON.stringify({ error: "未选择文本" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const agent = mastra.getAgent('sectionRewriter');

    const contextStr = [
      reason ? `## 重写要求\n${reason}` : "",
      voiceCard ? `## 声音卡\n${voiceCard}` : "",
      contextBefore ? `## 上下文（前文）\n${contextBefore}` : "",
      `## 需要重写的段落\n${selectedText}`,
      contextAfter ? `## 上下文（后文）\n${contextAfter}` : "",
    ].filter(Boolean).join("\n\n");

    const result = await agent.stream({
      messages: [{ role: 'user', content: contextStr }],
      runtimeContext: { chapterId },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("[API] 重写失败:", error);
    return new Response(
      JSON.stringify({ error: "重写失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}