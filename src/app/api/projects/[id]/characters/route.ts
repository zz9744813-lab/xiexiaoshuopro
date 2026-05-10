// API: 角色 CRUD
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const allCharacters = await db
      .select()
      .from(characters)
      .where(eq(characters.projectId, projectId));

    return NextResponse.json(allCharacters);
  } catch (error) {
    console.error("[API] 获取角色列表失败:", error);
    return NextResponse.json({ error: "获取角色列表失败" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const body = await request.json();
    const {
      name,
      tier = "walk_on",
      appearance,
      publicRole,
      voiceMd,
      secretMotive,
      trueIntent,
      arcGoal,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "角色名称为必填项" }, { status: 400 });
    }

    const [character] = await db
      .insert(characters)
      .values({
        projectId,
        name,
        tier,
        appearance,
        publicRole,
        voiceMd,
        secretMotive,
        trueIntent,
        arcGoal,
      })
      .returning();

    return NextResponse.json(character, { status: 201 });
  } catch (error) {
    console.error("[API] 创建角色失败:", error);
    return NextResponse.json({ error: "创建角色失败" }, { status: 500 });
  }
}
