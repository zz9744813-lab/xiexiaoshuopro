// API: 章节版本管理
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chapters, chapterVersions } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET: 获取章节的所有版本
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chapterId } = await params;

  try {
    const versions = await db
      .select()
      .from(chapterVersions)
      .where(eq(chapterVersions.chapterId, chapterId));

    const [chapter] = await db
      .select()
      .from(chapters)
      .where(eq(chapters.id, chapterId));

    return NextResponse.json({
      activeVersionId: chapter?.activeVersionId,
      versions: versions.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    });
  } catch (error) {
    console.error("[API] 获取版本列表失败:", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

// PATCH: 切换活跃版本
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chapterId } = await params;

  try {
    const body = await request.json();
    const { versionId } = body;

    if (!versionId) {
      return NextResponse.json({ error: "versionId 为必填" }, { status: 400 });
    }

    // 验证版本存在
    const [version] = await db
      .select()
      .from(chapterVersions)
      .where(eq(chapterVersions.id, versionId));

    if (!version || version.chapterId !== chapterId) {
      return NextResponse.json({ error: "版本不存在" }, { status: 404 });
    }

    // 切换活跃版本
    await db
      .update(chapters)
      .set({ activeVersionId: versionId })
      .where(eq(chapters.id, chapterId));

    return NextResponse.json({ success: true, activeVersionId: versionId });
  } catch (error) {
    console.error("[API] 切换版本失败:", error);
    return NextResponse.json({ error: "切换失败" }, { status: 500 });
  }
}
