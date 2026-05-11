// API: 世界时钟 + between-chapter events
import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@/mastra";
import { getModelForTask } from "@/lib/models";
import { db } from "@/db";
import { worldClock, betweenChapterEvents, projects } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET: 获取世界时钟状态
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const [clock] = await db
      .select()
      .from(worldClock)
      .where(eq(worldClock.projectId, projectId));

    const events = await db
      .select()
      .from(betweenChapterEvents)
      .where(eq(betweenChapterEvents.projectId, projectId));

    return NextResponse.json({ clock, events });
  } catch (error) {
    console.error("[API] 获取世界时钟失败:", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

// POST: 触发 WorldTick（生成 between-chapter events）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const body = await request.json();
    const { afterChapterId, currentWorldDate } = body;

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    const agent = mastra.getAgent("worldTick");

    const { text } = await agent.generate({
      messages: [{
        role: "user",
        content: `你是一位世界观管理员。在两章之间，世界在继续运转。

## 当前世界时间
${currentWorldDate || "未设定"}

## 小说类型
${project.genre}

## 任务
生成 0-3 个在主角不在场时发生的世界事件。这些事件会在未来章节中产生影响。

输出 JSON 数组：
[{
  "eventText": "事件描述",
  "visibility": "hidden|hinted|revealed",
  "visibleToCharacters": [],
  "triggersInChapter": null
}]

如果当前没有需要发生的事件，输出空数组 []。
直接输出 JSON。`
      }],
    });

    // 解析并保存事件
    let events = [];
    try {
      events = JSON.parse(text.trim());
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) events = JSON.parse(match[0]);
    }

    const savedEvents = [];
    for (const event of events) {
      const [saved] = await db
        .insert(betweenChapterEvents)
        .values({
          projectId,
          afterChapterId,
          eventText: event.eventText,
          visibility: event.visibility || "hidden",
          visibleToCharacters: event.visibleToCharacters,
          triggersInChapterId: event.triggersInChapter,
          createdByAgent: "world-tick",
        })
        .returning();
      savedEvents.push(saved);
    }

    return NextResponse.json({ events: savedEvents });
  } catch (error) {
    console.error("[API] WorldTick 失败:", error);
    return NextResponse.json({ error: "WorldTick 失败" }, { status: 500 });
  }
}
