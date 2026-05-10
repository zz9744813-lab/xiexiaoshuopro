// API: 生成章节细纲
import { NextRequest } from "next/server";
import { streamText } from "ai";
import { getModelForTask } from "@/lib/models";
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

    const { model, temperature, maxTokens } = getModelForTask("outline");

    const systemPrompt = `你是一位小说架构师。根据以下信息，为这一卷拆分章节细纲。

## 小说类型
${project.genre}

## 卷命题
${volumeThesis}

## Arc Beats
${JSON.stringify(arcBeats || [], null, 2)}

## 要求
生成 ${chapterCount || 10} 章的细纲，每章包含：
- chapterNum: 章节号
- title: 章节标题
- beats: 本章要推进的情节点（markdown）
- targetWordCount: 目标字数
- hookIntent: 章末钩子意图
- sceneMarkers: [{type: "dialogue"|"action"|"description", goal: "场景目标", estimatedWords: 数字}]

输出 JSON 数组，直接输出不要包裹代码块：
[{"chapterNum":1,"title":"...","beats":"...","targetWordCount":5000,"hookIntent":"...","sceneMarkers":[...]}]`;

    const result = streamText({
      model,
      temperature,
      maxOutputTokens: maxTokens,
      prompt: systemPrompt,
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
