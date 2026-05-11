// API: 创建卷 + 生成卷大纲
import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@/mastra";
import { getModelForTask } from "@/lib/models";
import { db } from "@/db";
import { projects, volumes } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET: 获取项目的所有卷
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const allVolumes = await db
      .select()
      .from(volumes)
      .where(eq(volumes.projectId, projectId));

    return NextResponse.json(allVolumes);
  } catch (error) {
    console.error("[API] 获取卷列表失败:", error);
    return NextResponse.json({ error: "获取卷列表失败" }, { status: 500 });
  }
}

// POST: 创建新卷并生成大纲
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const body = await request.json();
    const { thesis, title, volumeNum } = body;

    // 获取项目信息
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return new Response(JSON.stringify({ error: "项目不存在" }), { status: 404 });
    }

    // 创建卷
    const [volume] = await db
      .insert(volumes)
      .values({
        projectId,
        volumeNum: volumeNum || 1,
        title: title || `第${volumeNum || 1}卷`,
        thesis,
        status: "planning",
      })
      .returning();

    // 生成卷大纲（流式）
    const agent = mastra.getAgent("volumeOutline");

    const systemPrompt = `你是一位小说架构师。根据以下信息，为这一卷设计三幕弧和 arc beats。

## 小说类型
${project.genre}

## 卷命题
${thesis}

## 要求
输出 JSON 格式的三幕弧设计：
{
  "acts": [
    {"act": 1, "name": "起", "beats": [{"name": "beat名", "targetChapter": 1, "description": "描述"}]},
    {"act": 2, "name": "承转", "beats": [...]},
    {"act": 3, "name": "合", "beats": [...]}
  ],
  "readerPromise": "这卷给读者的承诺",
  "estimatedChapters": 20
}

直接输出 JSON，不要包裹在代码块中。`;

    const result = await agent.stream({
      messages: [{ role: "user", content: systemPrompt }],
    });

    // 返回卷信息 + 流式大纲
    return result.toDataStreamResponse({
      headers: {
        "X-Volume-Id": volume.id,
      },
    });
  } catch (error) {
    console.error("[API] 创建卷失败:", error);
    return new Response(
      JSON.stringify({ error: "创建卷失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
