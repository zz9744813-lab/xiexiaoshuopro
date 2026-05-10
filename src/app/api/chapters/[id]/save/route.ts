// API: 保存章节版本
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chapters, chapterVersions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chapterId } = await params;

  try {
    const body = await request.json();
    const { contentMd, source = "initial", versionLabel } = body;

    if (!contentMd) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    }

    // 获取当前章节
    const [chapter] = await db
      .select()
      .from(chapters)
      .where(eq(chapters.id, chapterId));

    if (!chapter) {
      return NextResponse.json({ error: "章节不存在" }, { status: 404 });
    }

    // 创建新版本
    const [version] = await db
      .insert(chapterVersions)
      .values({
        chapterId,
        contentMd,
        source,
        versionLabel: versionLabel || `v${Date.now()}`,
        parentVersionId: chapter.activeVersionId,
        createdBy: "ai",
      })
      .returning();

    // 更新章节的 active version
    await db
      .update(chapters)
      .set({
        activeVersionId: version.id,
        status: "drafted",
      })
      .where(eq(chapters.id, chapterId));

    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    console.error("[API] 保存章节失败:", error);
    return NextResponse.json({ error: "保存失败" }, { status: 500 });
  }
}
