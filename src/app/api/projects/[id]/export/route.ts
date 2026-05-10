// API: 导出项目内容
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, volumes, chapters, chapterVersions, chapterOutlines } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const body = await request.json();
    const { format = "md", scope = "full" } = body;

    // 获取项目
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    // 获取所有卷
    const allVolumes = await db
      .select()
      .from(volumes)
      .where(eq(volumes.projectId, projectId))
      .orderBy(asc(volumes.volumeNum));

    // 构建 markdown 内容
    const parts: string[] = [];
    parts.push(`# ${project.title}\n`);
    parts.push(`> 类型：${project.genre}\n`);
    parts.push("---\n");

    for (const vol of allVolumes) {
      parts.push(`\n## 第${vol.volumeNum}卷 ${vol.title}\n`);
      if (vol.thesis) {
        parts.push(`*命题：${vol.thesis}*\n`);
      }

      // 获取该卷的章节大纲
      const outlines = await db
        .select()
        .from(chapterOutlines)
        .where(eq(chapterOutlines.volumeId, vol.id))
        .orderBy(asc(chapterOutlines.chapterNum));

      for (const outline of outlines) {
        // 获取对应的章节内容
        const [chapter] = await db
          .select()
          .from(chapters)
          .where(eq(chapters.chapterOutlineId, outline.id));

        parts.push(`\n### 第${outline.chapterNum}章 ${outline.title}\n`);

        if (chapter && chapter.activeVersionId) {
          const [version] = await db
            .select()
            .from(chapterVersions)
            .where(eq(chapterVersions.id, chapter.activeVersionId));

          if (version && version.contentMd) {
            parts.push(version.contentMd);
            parts.push("\n");
          } else {
            parts.push("*（未生成）*\n");
          }
        } else {
          parts.push("*（未生成）*\n");
        }
      }
    }

    const content = parts.join("\n");

    if (format === "md") {
      return new Response(content, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${project.title}.md"`,
        },
      });
    }

    // 其他格式暂返回 JSON
    return NextResponse.json({
      format,
      title: project.title,
      content,
      wordCount: content.length,
    });
  } catch (error) {
    console.error("[API] 导出失败:", error);
    return NextResponse.json({ error: "导出失败" }, { status: 500 });
  }
}
