// API: 角色详情 (GET + PATCH + 知识/关系)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { characters, characterKnowledge, characterRelationships, characterEpisodicMemory } from "@/db/schema";
import { eq, or, and } from "drizzle-orm";

// GET: 获取角色完整档案
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; charId: string }> }
) {
  const { charId } = await params;

  try {
    const [character] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, charId));

    if (!character) {
      return NextResponse.json({ error: "角色不存在" }, { status: 404 });
    }

    // 获取知识状态
    const knowledge = await db
      .select()
      .from(characterKnowledge)
      .where(eq(characterKnowledge.characterId, charId));

    // 获取关系
    const relationships = await db
      .select()
      .from(characterRelationships)
      .where(
        or(
          eq(characterRelationships.characterA, charId),
          eq(characterRelationships.characterB, charId)
        )
      );

    // 获取记忆
    const memories = await db
      .select()
      .from(characterEpisodicMemory)
      .where(eq(characterEpisodicMemory.characterId, charId));

    return NextResponse.json({
      ...character,
      knowledge: {
        facts: knowledge.filter(k => k.category === "fact"),
        suspected: knowledge.filter(k => k.category === "suspected"),
        lies: knowledge.filter(k => k.category === "lie"),
      },
      relationships,
      episodicMemory: memories,
    });
  } catch (error) {
    console.error("[API] 获取角色详情失败:", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

// PATCH: 更新角色
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; charId: string }> }
) {
  const { charId } = await params;

  try {
    const body = await request.json();
    const allowedFields = [
      "name", "tier", "appearance", "publicRole", "voiceMd",
      "secretMotive", "trueIntent", "arcGoal", "arcPosition",
      "currentEmotionalState", "alive",
    ];

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    const [updated] = await db
      .update(characters)
      .set(updateData)
      .where(eq(characters.id, charId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "角色不存在" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[API] 更新角色失败:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}
