// API: 生成命题候选 (流式)
import { NextRequest } from "next/server";
import { streamText } from "ai";
import { getModelForTask } from "@/lib/models";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    // 获取项目信息
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return new Response(JSON.stringify({ error: "项目不存在" }), { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const seed = body.seed || project.authorNotes || "";

    const { model, temperature, maxTokens } = getModelForTask("outline");

    const systemPrompt = `你是一位资深小说策划。根据以下信息，生成 3 个强制差异化的卷命题候选。

## 小说类型
${project.genre}

## 种子创意
${seed}

## 要求
1. 3 个候选必须分别落在不同的方差轴上（道德/身份/体系/关系）
2. 每个候选包含：thesis(命题), coreConflict(核心冲突), emotionalTone(情感基调), readerPromise(读者承诺), varianceAxis(方差轴)
3. 候选之间要有明显差异

## 输出格式
直接输出 JSON 数组，不要包裹在代码块中：
[{"id":1,"thesis":"...","coreConflict":"...","emotionalTone":"...","readerPromise":"...","varianceAxis":"..."}]`;

    const result = streamText({
      model,
      temperature,
      maxOutputTokens: maxTokens,
      prompt: systemPrompt,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[API] 命题生成失败:", error);
    return new Response(
      JSON.stringify({ error: "命题生成失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
