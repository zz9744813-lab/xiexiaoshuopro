// API: 章节生成 (SSE 流式) - 服务端读上下文，通过 agent 生成，流式同时落库
import { NextRequest } from "next/server";
import { mastra } from "@/mastra";
import { getModelForTask } from "@/lib/models";
import { loadPrompt } from "@/lib/prompts";
import { db } from "@/db";
import {
  chapters, chapterOutlines, chapterVersions, chapterSummaries,
  characters, projects, volumes, worldEntries, voiceCards,
  betweenChapterEvents,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chapterId } = await params;

  try {
    // ===== 服务端读取所有上下文 =====

    // 获取章节信息
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, chapterId));
    if (!chapter) {
      return new Response(JSON.stringify({ error: "章节不存在" }), { status: 404 });
    }

    // 获取章节大纲
    const [outline] = await db.select().from(chapterOutlines).where(eq(chapterOutlines.id, chapter.chapterOutlineId));

    // 获取卷信息
    let volume = null;
    let project = null;
    if (outline) {
      [volume] = await db.select().from(volumes).where(eq(volumes.id, outline.volumeId));
      if (volume) {
        [project] = await db.select().from(projects).where(eq(projects.id, volume.projectId));
      }
    }

    // 获取前一章摘要
    let previousSummary = "";
    if (outline && outline.chapterNum > 1) {
      const prevOutlines = await db.select().from(chapterOutlines)
        .where(eq(chapterOutlines.volumeId, outline.volumeId));
      const prevOutline = prevOutlines.find(o => o.chapterNum === outline.chapterNum - 1);
      if (prevOutline) {
        const [prevChapter] = await db.select().from(chapters)
          .where(eq(chapters.chapterOutlineId, prevOutline.id));
        if (prevChapter) {
          const [prevSummary] = await db.select().from(chapterSummaries)
            .where(eq(chapterSummaries.chapterId, prevChapter.id));
          if (prevSummary) {
            previousSummary = prevSummary.shortSummary || "";
          }
        }
      }
    }

    // 获取出场角色
    let charactersText = "";
    if (outline?.charactersPresent && Array.isArray(outline.charactersPresent)) {
      const charIds = outline.charactersPresent as string[];
      if (charIds.length > 0) {
        const chars = await db.select().from(characters).where(inArray(characters.id, charIds));
        charactersText = chars.map(c =>
          `- ${c.name}（${c.publicRole || ""}）：${c.secretMotive || ""}`
        ).join("\n");
      }
    }

    // 获取声音卡
    let voiceCardText = project?.voiceMd || "";
    if (project) {
      const cards = await db.select().from(voiceCards).where(eq(voiceCards.projectId, project.id));
      const projectCard = cards.find(c => c.scope === "project");
      if (projectCard?.cardMd) voiceCardText = projectCard.cardMd;
    }

    // 获取章间事件
    let worldEventsText = "";
    if (project) {
      const events = await db.select().from(betweenChapterEvents)
        .where(eq(betweenChapterEvents.projectId, project.id));
      const relevant = events.filter(e => !e.acknowledgedByUser);
      if (relevant.length > 0) {
        worldEventsText = relevant.map(e => `- [${e.visibility}] ${e.eventText}`).join("\n");
      }
    }

    // ===== 构建 prompt 并生成 =====

    const agent = mastra.getAgent("chapterDraft");

    // ===== 流式生成 =====
    const result = await agent.stream({
      messages: [{ role: "user", content: outline?.beatsMd || outline?.title || "写一章小说正文" }],
      // @ts-ignore - Mastra run context
      runtimeContext: {
        projectId: project?.id,
        chapterId: chapterId,
        outline: outline?.beatsMd || outline?.title || "",
        genre: project?.genre,
        voiceCard: voiceCardText,
        volumeNum: volume?.volumeNum,
        volumeTitle: volume?.title,
        volumeThesis: volume?.thesis,
        prevChapterSummary: previousSummary,
        charactersPresent: charactersText,
        targetWordCount: outline?.targetWordCount,
        hookIntent: outline?.hookIntent,
        worldEvents: worldEventsText,
      },
      onFinish: async (text: string) => {
        // 流结束后服务端自动保存到数据库
        if (text && text.length > 50) {
          try {
            const [version] = await db.insert(chapterVersions).values({
              chapterId,
              contentMd: text,
              source: "initial",
              versionLabel: `draft-${Date.now()}`,
              parentVersionId: chapter.activeVersionId,
              createdBy: "ai",
            }).returning();

            await db.update(chapters).set({
              activeVersionId: version.id,
              status: "drafted",
            }).where(eq(chapters.id, chapterId));
          } catch (err) {
            console.error("[generate] 自动保存失败:", err);
          }
        }
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("[API] 章节生成失败:", error);
    return new Response(
      JSON.stringify({ error: "章节生成失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
