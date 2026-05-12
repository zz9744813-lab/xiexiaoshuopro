// API: 章节定稿 - 真正触发审查 + 摘要 + Bible 抽取 + 世界时钟
import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@/mastra";
import { db } from "@/db";
import { chapters, chapterVersions, chapterSummaries, betweenChapterEvents, projects, volumes, chapterOutlines } from "@/db/schema";
import { eq } from "drizzle-orm";
import { computeStyleFingerprint } from "@/lib/style-fingerprint";
import { detectSlop } from "@/lib/slop-detector";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chapterId } = await params;

  try {
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, chapterId));
    if (!chapter || !chapter.activeVersionId) {
      return NextResponse.json({ error: "章节不存在或无内容" }, { status: 404 });
    }

    const [version] = await db.select().from(chapterVersions)
      .where(eq(chapterVersions.id, chapter.activeVersionId));
    if (!version || !version.contentMd) {
      return NextResponse.json({ error: "章节内容为空" }, { status: 404 });
    }

    const text = version.contentMd;

    // 1. 更新状态
    await db.update(chapters).set({
      status: "finalized",
      finalizedAt: new Date(),
      finalizedWordCount: text.length,
    }).where(eq(chapters.id, chapterId));

    // 2. 计算文风指纹
    const fingerprint = computeStyleFingerprint(text);

    // 3. Slop 检测
    const slopHits = detectSlop(text);

    // 4. 生成摘要（通过 chapterSummary agent）
    let summaryResult = null;
    try {
      const agent = mastra.getAgent("chapterSummary");
      const { text: summaryText } = await agent.generate({
        messages: [{
          role: "user",
          content: text.slice(0, 6000),
        }],
        runtimeContext: { chapterId, projectId: "" },
      });

      const jsonMatch = summaryText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summaryResult = JSON.parse(jsonMatch[0]);
        await db.insert(chapterSummaries).values({
          chapterId,
          versionId: chapter.activeVersionId,
          shortSummary: summaryResult.shortSummary,
          longSummary: summaryResult.longSummary,
          keyEvents: summaryResult.keyEvents,
          readerQuestionsRaised: summaryResult.readerQuestionsRaised,
          readerQuestionsAnswered: summaryResult.readerQuestionsAnswered,
        });
      }
    } catch (err) {
      console.error("[finalize] 摘要生成失败:", err);
    }

    // 5. 世界时钟推进（生成 between-chapter events，通过 bibleExtract agent）
    let worldEvents: unknown[] = [];
    try {
      const [outline] = await db.select().from(chapterOutlines)
        .where(eq(chapterOutlines.id, chapter.chapterOutlineId));
      let projectId = "";
      if (outline) {
        const [vol] = await db.select().from(volumes).where(eq(volumes.id, outline.volumeId));
        if (vol) projectId = vol.projectId;
      }

      if (projectId) {
        const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
        const agent = mastra.getAgent("bibleExtract");
        const { text: eventsText } = await agent.generate({
          messages: [{
            role: "user",
            content: `类型：${project?.genre || ""}\n章节内容：${text.slice(0, 3000)}`,
          }],
          runtimeContext: { projectId, chapterId },
        });

        const eventsMatch = eventsText.match(/\[[\s\S]*\]/);
        if (eventsMatch) {
          const parsed = JSON.parse(eventsMatch[0]);
          for (const event of parsed) {
            const [saved] = await db.insert(betweenChapterEvents).values({
              projectId,
              afterChapterId: chapterId,
              eventText: event.eventText,
              visibility: event.visibility || "hidden",
              createdByAgent: "world-tick",
            }).returning();
            worldEvents.push(saved);
          }
        }
      }
    } catch (err) {
      console.error("[finalize] WorldTick 失败:", err);
    }

    return NextResponse.json({
      success: true,
      chapterId,
      wordCount: text.length,
      fingerprint,
      slopHits: slopHits.length,
      slopRate: (slopHits.length / text.length * 100).toFixed(3) + "%",
      summary: summaryResult,
      worldEventsGenerated: worldEvents.length,
      completedTasks: [
        "status-update",
        "style-fingerprint",
        "slop-detection",
        summaryResult ? "summary-generated" : "summary-failed",
        worldEvents.length > 0 ? "world-tick-generated" : "world-tick-skipped",
      ],
    });
  } catch (error) {
    console.error("[API] Finalize 失败:", error);
    return NextResponse.json({ error: "Finalize 失败" }, { status: 500 });
  }
}