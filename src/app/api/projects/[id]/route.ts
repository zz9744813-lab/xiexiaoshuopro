// API: 项目详情 (GET + PATCH)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id));

    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("[API] 获取项目失败:", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const allowedFields = ["title", "genre", "voiceMd", "authorNotes", "safetyLevel", "genreConfig", "modelRouting"];

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    const [updated] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[API] 更新项目失败:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}
