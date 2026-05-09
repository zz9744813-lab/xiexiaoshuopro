// API: 章节生成 (SSE 流式)
import { NextRequest } from "next/server";
import { streamText } from "ai";
import { getModelForTask } from "@/lib/models";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chapterId } = await params;

  try {
    const body = await request.json();
    const { outline, previousSummary, characters, voiceCard, genre } = body;

    // 构建 prompt
    const systemPrompt = buildChapterPrompt({
      outline,
      previousSummary,
      characters,
      voiceCard,
      genre,
    });

    const { model, temperature, maxTokens } = getModelForTask("draft", body.safetyLevel || "normal");

    const result = streamText({
      model,
      temperature,
      maxOutputTokens: maxTokens,
      system: systemPrompt,
      prompt: `请根据以上设定，写出本章正文。章节 ID: ${chapterId}`,
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

function buildChapterPrompt(ctx: {
  outline?: string;
  previousSummary?: string;
  characters?: string;
  voiceCard?: string;
  genre?: string;
}): string {
  const parts: string[] = [];

  parts.push("你是一位专业的小说执笔者。请根据以下信息写出高质量的章节正文。");
  parts.push("");

  if (ctx.genre) {
    parts.push(`## 类型\n${ctx.genre}`);
    parts.push("");
  }

  if (ctx.voiceCard) {
    parts.push(`## 声音卡\n${ctx.voiceCard}`);
    parts.push("");
  }

  if (ctx.previousSummary) {
    parts.push(`## 上一章摘要\n${ctx.previousSummary}`);
    parts.push("");
  }

  if (ctx.outline) {
    parts.push(`## 本章细纲\n${ctx.outline}`);
    parts.push("");
  }

  if (ctx.characters) {
    parts.push(`## 涉及人物\n${ctx.characters}`);
    parts.push("");
  }

  parts.push("## 写作要求");
  parts.push("1. 直接输出 markdown 正文，不要前置说明");
  parts.push("2. 避免 AI 味表达（不禁、眼中闪烁、不由自主等）");
  parts.push("3. 章末留有钩子");
  parts.push("4. 保持人物声音一致性");

  return parts.join("\n");
}
