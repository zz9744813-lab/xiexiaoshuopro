// API: 章节生成 (SSE 流式) - 服务端读上下文，通过 agent 生成，流式同时落库
import { NextRequest } from "next/server";
import { streamText } from "ai";
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

    // 尝试从 prompt 文件加载并渲染
    const promptVars: Record<string, string> = {
      project_title: project?.title || "",
      genre: project?.genre || "",
      voice_card: voiceCardText,
      volume_num: String(volume?.volumeNum || 1),
      volume_title: volume?.title || "",
      volume_thesis: volume?.thesis || "",
      prev_chapter_summary: previousSummary,
      chapter_outline: outline?.beatsMd || outline?.title || "",
      characters_present: charactersText,
      target_word_count: String(outline?.targetWordCount || 5000),
      pov_character: "",
      hook_intent: outline?.hookIntent || "留下悬念",
      bible_extract: "",
      between_chapter_events: worldEventsText,
      slop_blacklist: "不禁、眼中闪烁着、不由自主、心中一动、嘴角微微上扬",
      delivers_arc_beats: "",
      genre_contract: "",
    };

    let systemPrompt = loadPrompt("agents/chapter-draft.md", promptVars);

    // 如果 prompt 文件不存在或为空，使用内联 fallback
    if (!systemPrompt.trim()) {
      systemPrompt = buildFallbackPrompt(promptVars);
    }

    const { model, temperature, maxTokens } = getModelForTask(
      "draft",
      project?.safetyLevel || "normal"
    );

    // ===== 流式生成 =====
    const result = streamText({
      model,
      temperature,
      maxOutputTokens: maxTokens,
      system: systemPrompt,
      prompt: "请根据以上设定，写出本章正文。",
      onFinish: async ({ text }) => {
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

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[API] 章节生成失败:", error);
    return new Response(
      JSON.stringify({ error: "章节生成失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

function buildFallbackPrompt(vars: Record<string, string>): string {
  const parts: string[] = [];
  parts.push(`你是「${vars.project_title || "小说"}」的执笔者。类型：${vars.genre || "通用"}。`);
  parts.push("");
  if (vars.voice_card) parts.push(`## 声音卡\n${vars.voice_card}\n`);
  if (vars.prev_chapter_summary) parts.push(`## 上一章摘要\n${vars.prev_chapter_summary}\n`);
  if (vars.chapter_outline) parts.push(`## 本章细纲\n${vars.chapter_outline}\n`);
  if (vars.characters_present) parts.push(`## 涉及人物\n${vars.characters_present}\n`);
  if (vars.between_chapter_events) parts.push(`## 章间事件\n${vars.between_chapter_events}\n`);
  parts.push("## 写作要求");
  parts.push("1. 直接输出 markdown 正文，不要前置说明");
  parts.push("2. 避免 AI 味表达");
  parts.push("3. 章末留有钩子");
  parts.push(`4. 目标字数 ${vars.target_word_count}`);
  if (vars.slop_blacklist) parts.push(`5. 避开：${vars.slop_blacklist}`);
  return parts.join("\n");
}
