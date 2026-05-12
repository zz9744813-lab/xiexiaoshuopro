// API: 章节定稿 - 触发审查 + 摘要 + Bible 抽取 + 世界时钟
import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@/mastra";
import { db } from "@/db";
import { chapters, chapterVersions, bibleFacts, worldClock } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runReviewWorkflow } from "@/mastra/workflows/review";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chapterId } = await params;
  try {
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, chapterId));
    if (!chapter) return NextResponse.json({ error: "章节不存在" }, { status: 404 });

    const [version] = await db
      .select()
      .from(chapterVersions)
      .where(eq(chapterVersions.chapterId, chapterId))
      .orderBy(chapterVersions.version);
    if (!version) return NextResponse.json({ error: "无草稿内容" }, { status: 404 });

    const content = version.content;
    const projectId = chapter.projectId;

    // 1. 审查
    const reviewResult = await runReviewWorkflow({
      content, projectId, chapterId,
      genre: chapter.genre, voiceCard: chapter.voiceCard,
    });

    // 2. 摘要 (Mastra agent)
    let summary;
    try {
      const agent = mastra.getAgent("chapterSummary");
      const { text } = await agent.generate({
        messages: [{ role: "user", content: `请为以下章节生成摘要。\n\n${content.slice(0, 6000)}` }],
        runtimeContext: { projectId, chapterId },
      });
      const match = text.match(/\{[\s\S]*\}/);
      if (match) summary = JSON.parse(match[0]);
    } catch { /* 摘要失败不阻塞 */ }

    // 3. Bible 抽取 (Mastra agent)
    try {
      const agent = mastra.getAgent("bibleExtract");
      const { text } = await agent.generate({
        messages: [{ role: "user", content }],
        runtimeContext: { projectId, chapterId },
      });
      const facts = text.match(/\{[\s\S]*\}/) ? JSON.parse(text.match(/\{[\s\S]*\}/)![0]) : [];
      for (const fact of facts) {
        await db.insert(bibleFacts).values({
          projectId, chapterId, type: fact.type || "general",
          content: fact.content || fact.fact, confidence: fact.confidence || 1,
          source: "auto-extract",
        });
      }
    } catch { /* Bible 抽取失败不阻塞 */ }

    // 4. 推进世界时钟
    await db.update(worldClock).set({ tickCount: 1 }).where(eq(worldClock.projectId, projectId));

    // 标记章节为 finalized
    await db.update(chapters).set({ status: "finalized" }).where(eq(chapters.id, chapterId));

    return NextResponse.json({
      success: true,
      review: reviewResult,
      summary,
    });
  } catch (error) {
    console.error("[API] 定稿失败:", error);
    return NextResponse.json({ error: "定稿失败" }, { status: 500 });
  }
}