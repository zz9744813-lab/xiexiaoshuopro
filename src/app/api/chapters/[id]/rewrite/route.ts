// API: 段落重写 (流式)
import { NextRequest } from "next/server";
import { mastra } from "@/mastra";
import { getModelForTask } from "@/lib/models";

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

    const { model, temperature, maxTokens } = getModelForTask("rewrite");

    const systemPrompt = `你是一位小说编辑。用户选中了一段文本要求重写。

## 重写要求
${reason || "提升文字质量，保持原意"}

${voiceCard ? `## 声音卡\n${voiceCard}\n` : ""}

## 上下文（前文）
${contextBefore || "（无）"}

## 需要重写的段落
${selectedText}

## 上下文（后文）
${contextAfter || "（无）"}

## 规则
1. 保持原文的核心信息和情节推进
2. 提升文字质量，消除 AI 味
3. 保持与上下文的衔接自然
4. 直接输出重写后的文本，不要解释`;

    const agent = mastra.getAgent("sectionRewriter");
    const result = await agent.stream({
      messages: [{ role: "user", content: systemPrompt }],
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
