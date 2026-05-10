// API: 势力关系矩阵
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { worldEntries } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET: 获取势力列表和关系
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    // 获取所有 faction 类型的 world entries
    const allEntries = await db
      .select()
      .from(worldEntries)
      .where(eq(worldEntries.projectId, projectId));

    const factions = allEntries.filter(e => e.kind === "faction");

    return NextResponse.json({
      factions: factions.map(f => ({
        id: f.id,
        name: f.name,
        description: f.description,
        rules: f.rules,
      })),
    });
  } catch (error) {
    console.error("[API] 获取势力失败:", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

// POST: 添加势力
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const body = await request.json();
    const { name, description, ideology, powerLevel } = body;

    if (!name) {
      return NextResponse.json({ error: "名称为必填" }, { status: 400 });
    }

    const [faction] = await db
      .insert(worldEntries)
      .values({
        projectId,
        kind: "faction",
        name,
        description: description || ideology,
        rules: powerLevel ? `实力等级: ${powerLevel}` : null,
      })
      .returning();

    return NextResponse.json(faction, { status: 201 });
  } catch (error) {
    console.error("[API] 创建势力失败:", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
