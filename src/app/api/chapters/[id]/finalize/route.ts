// API: 章节定稿（触发审查 + Bible 抽取 + 世界时钟）
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chapters, chapterVersions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { computeStyleFingerprint } from "@/lib/style-fingerprint";
import { detectSlop } from "@/lib/slop-detector";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chapterId } = await params;

  try {
    // 获取章节
    const [chapter] = await db
      .select()
      .from(chapters)
      .where(eq(chapters.id, chapterId));

    if (!chapter || !chapter.activeVersionId) {
      return NextResponse.json({ error: "章节不存在或无内容" }, { status: 404 });
    }

    // 获取当前版本内容
    const [version] = await db
      .select()
      .from(chapterVersions)
      .where(eq(chapterVersions.id, chapter.activeVersionId));

    if (!version || !version.contentMd) {
      return NextResponse.json({ error: "章节内容为空" }, { status: 404 });
    }

    const text = version.contentMd;

    // 1. 计算文风指纹
    const fingerprint = computeStyleFingerprint(text);

    // 2. 运行 Slop 检测
    const slopHits = detectSlop(text);

    // 3. 更新章节状态为 finalized
    await db
      .update(chapters)
      .set({
        status: "finalized",
        finalizedAt: new Date(),
        finalizedWordCount: text.length,
      })
      .where(eq(chapters.id, chapterId));

    // 返回 finalize 结果
    return NextResponse.json({
      success: true,
      chapterId,
      wordCount: text.length,
      fingerprint,
      slopHits: slopHits.length,
      slopRate: text.length > 0 ? (slopHits.length / text.length * 100).toFixed(3) + "%" : "0%",
      // 后续异步触发的任务
      triggeredTasks: [
        "chapter-summary",    // 生成/更新摘要
        "bible-extract",      // 抽取世界观
        "world-tick",         // 推进世界时钟
        "review-workflow",    // 审查流程
        "style-fingerprint",  // 保存文风指纹
      ],
    });
  } catch (error) {
    console.error("[API] Finalize 失败:", error);
    return NextResponse.json({ error: "Finalize 失败" }, { status: 500 });
  }
}
