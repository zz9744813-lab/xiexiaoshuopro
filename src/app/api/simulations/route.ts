// API: 推演管理
import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@/mastra";
import { db } from "@/db";
import { simulations, characters } from "@/db/schema";
import { inArray } from "drizzle-orm";

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
      maxTurns = 90,
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

    // 构建上下文
    const characterDescriptions = involvedCharacters
      .map((c) => `- ${c.name}（${c.publicRole || "未知身份"}）：${c.secretMotive || "无特殊动机"}`)
      .join("\n");

    const contextPrompt = [
      `director_goal: ${directorGoal}`,
      `characters: ${characterDescriptions}`,
      `pov: ${povChoice || "第三人称全知"}`,
      `max_turns: ${maxTurns}`,
    ].join("\n");

    // 通过 Mastra director agent
    const agent = mastra.getAgent("director");

    const result = await agent.stream({
      messages: [
        {
          role: "user",
          content: contextPrompt,
        },
      ],
      runtimeContext: {
        projectId,
        simulationId: simulation.id,
      },
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