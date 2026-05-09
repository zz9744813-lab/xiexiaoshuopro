// API: 创建项目
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, genre, seed } = body;

    if (!title || !genre) {
      return NextResponse.json(
        { error: "标题和类型为必填项" },
        { status: 400 }
      );
    }

    const [project] = await db
      .insert(projects)
      .values({
        title,
        genre,
        authorNotes: seed || null,
        safetyLevel: "normal",
      })
      .returning();

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("[API] 创建项目失败:", error);
    return NextResponse.json(
      { error: "创建项目失败" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const allProjects = await db.select().from(projects);
    return NextResponse.json(allProjects);
  } catch (error) {
    console.error("[API] 获取项目列表失败:", error);
    return NextResponse.json(
      { error: "获取项目列表失败" },
      { status: 500 }
    );
  }
}
