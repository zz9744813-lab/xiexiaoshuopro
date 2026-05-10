// API: 推演管理
import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { getModelForTask } from "@/lib/models";
import { db } from "@/db";
import { simulations, simulationTurns, characters } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

// POST: 启动推演
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectId,
      sceneMarkerId,
      characterIds,
      directorGoal,
      povChoice,
      maxTurns = 30,
    } = body;

    if (!projectId || !characterIds?.length || !directorGoal) {
      return NextResponse.json(
        { error: "projectId, characterIds, directorGoal 为必填" },
        { status: 400 }
      );
    }

    // 获取参与角色信息
    const involvedCharacters = await db
      .select()
      .from(characters)
      .where(inArray(characters.id, characterIds));

    // 创建推演记录
    const [simulation] = await db
      .insert(simulations)
      .values({
        projectId,
        sceneMarkerId,
        status: "running",
        charactersInvolved: involvedCharacters.map((c) => ({
          id: c.id,
          name: c.name,
          tier: c.tier,
        })),
        directorGoal,
        povChoice,
        startedAt: new Date(),
      })
      .returning();

    // 构建推演 prompt
    const characterDescriptions = involvedCharacters
      .map((c) => `- ${c.name}（${c.publicRole || "未知身份"}）：${c.secretMotive || "无特殊动机"}`)
      .join("\n");

    const { model, temperature, maxTokens } = getModelForTask("simulation");

    const systemPrompt = `你是一位小说推演导演。你需要模拟以下角色之间的互动场景。

## 场景目标
${directorGoal}

## 参与角色
${characterDescriptions}

## POV
${povChoice || "第三人称全知"}

## 规则
1. 每个角色的行为必须符合其性格和动机
2. 角色只能基于自己知道的信息做决策
3. 每轮输出一个角色的言行，格式为：
   【角色名】：（动作描写）"对话内容"
   [内心]：角色的内心想法（其他角色不可见）
4. 在适当时机推进剧情，不要原地踏步
5. 当场景目标达成或达到自然结束点时，输出 [END]
6. 最多 ${maxTurns} 轮

开始推演：`;

    const result = streamText({
      model,
      temperature,
      maxOutputTokens: maxTokens * 5, // 推演需要更多 token
      prompt: systemPrompt,
    });

    // 返回推演 ID + 流式内容
    return result.toTextStreamResponse({
      headers: {
        "X-Simulation-Id": simulation.id,
      },
    });
  } catch (error) {
    console.error("[API] 启动推演失败:", error);
    return NextResponse.json({ error: "启动推演失败" }, { status: 500 });
  }
}

// GET: 获取推演列表
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "需要 projectId" }, { status: 400 });
  }

  try {
    const allSimulations = await db
      .select()
      .from(simulations)
      .where(eq(simulations.projectId, projectId));

    return NextResponse.json(allSimulations);
  } catch (error) {
    console.error("[API] 获取推演列表失败:", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}
