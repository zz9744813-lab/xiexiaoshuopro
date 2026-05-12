// API: 生成章节摘要 — 通过 Mastra Agent 调用
import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@/mastra";
import { db } from "@/db";
import { chapters, chapterVersions, chapterSummaries } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chapterId } = await params;

  try {
    // 获取章节当前版本内容
    const [chapter] = await db
      .select()
      .from(chapters)
      .where(eq(chapters.id, chapterId));

    if (!chapter || !chapter.activeVersionId) {
      return NextResponse.json({ error: "章节不存在或无内容" }, { status: 404 });
    }

    const [version] = await db
      .select()
      .from(chapterVersions)
      .where(eq(chapterVersions.id, chapter.activeVersionId));

    if (!version || !version.contentMd) {
      return NextResponse.json({ error: "章节内容为空" }, { status: 404 });
    }

    const agent = mastra.getAgent('chapterSummary');

    const result = await agent.generate({
      messages: [{
        role: 'user',
        content: `请为以下章节内容生成结构化摘要。\n\n${version.contentMd.slice(0, 8000)}`,
      }],
      runtimeContext: { chapterId },
    });

    // 解析摘要
    let summaryData;
    const text = result.text;
    try {
      summaryData = JSON.parse(text.trim());
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summaryData = JSON.parse(jsonMatch[0]);
      } else {
        summaryData = { shortSummary: text.slice(0, 200), longSummary: text };
      }
    }

    // 保存摘要
    const [summary] = await db
      .insert(chapterSummaries)
      .values({
        chapterId,
        versionId: chapter.activeVersionId,
        shortSummary: summaryData.shortSummary,
        longSummary: summaryData.longSummary,
        emotionalArc: summaryData.emotionalArc,
        keyEvents: summaryData.keyEvents,
        readerQuestionsRaised: summaryData.readerQuestionsRaised,
        readerQuestionsAnswered: summaryData.readerQuestionsAnswered,
      })
      .returning();

    return NextResponse.json(summary, { status: 201 });
  } catch (error) {
    console.error("[API] 生成摘要失败:", error);
    return NextResponse.json({ error: "生成摘要失败" }, { status: 500 });
  }
}