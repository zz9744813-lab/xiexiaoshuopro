// API: 章节审查（SlopDetector + 基础检查）
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chapters, chapterVersions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { detectSlop } from "@/lib/slop-detector";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chapterId } = await params;

  try {
    // 获取章节内容
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

    const text = version.contentMd;
    const issues: Array<{
      axis: string;
      severity: string;
      title: string;
      description: string;
      evidence: string;
      proposedFix: string;
    }> = [];

    // 1. Slop 检测
    const slopHits = detectSlop(text);
    if (slopHits.length > 0) {
      // 按 category 分组
      const grouped = new Map<string, typeof slopHits>();
      for (const hit of slopHits) {
        const existing = grouped.get(hit.category) || [];
        existing.push(hit);
        grouped.set(hit.category, existing);
      }

      for (const [category, hits] of grouped) {
        issues.push({
          axis: "aislop",
          severity: hits.length >= 5 ? "critical" : "warning",
          title: `AI 味表达 (${category}): ${hits.length} 处`,
          description: `检测到 ${hits.length} 处 ${category} 类型的 AI 味表达`,
          evidence: hits.slice(0, 3).map((h) => `"${h.context}"`).join("\n"),
          proposedFix: hits[0].replacement,
        });
      }
    }

    // 2. 基础文本检查
    const sentences = text.split(/[。！？\n]/).filter((s) => s.trim().length > 0);
    const avgSentenceLen = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;

    // 句长方差检查
    if (avgSentenceLen > 80) {
      issues.push({
        axis: "pacing",
        severity: "info",
        title: "平均句长偏长",
        description: `平均句长 ${Math.round(avgSentenceLen)} 字，可能影响阅读节奏`,
        evidence: "",
        proposedFix: "考虑拆分长句，增加短句变化",
      });
    }

    // 3. 重复检查
    const paragraphs = text.split("\n\n").filter((p) => p.trim().length > 0);
    const startPatterns = new Map<string, number>();
    for (const p of paragraphs) {
      const start = p.trim().slice(0, 4);
      startPatterns.set(start, (startPatterns.get(start) || 0) + 1);
    }
    for (const [pattern, count] of startPatterns) {
      if (count >= 3) {
        issues.push({
          axis: "aislop",
          severity: "warning",
          title: `段落开头重复: "${pattern}..."`,
          description: `有 ${count} 个段落以 "${pattern}" 开头，结构单调`,
          evidence: "",
          proposedFix: "变化段落开头，避免模式化",
        });
      }
    }

    return NextResponse.json({
      chapterId,
      totalIssues: issues.length,
      slopHits: slopHits.length,
      slopRate: text.length > 0 ? (slopHits.length / text.length * 100).toFixed(3) + "%" : "0%",
      avgSentenceLength: Math.round(avgSentenceLen),
      issues,
    });
  } catch (error) {
    console.error("[API] 审查失败:", error);
    return NextResponse.json({ error: "审查失败" }, { status: 500 });
  }
}
