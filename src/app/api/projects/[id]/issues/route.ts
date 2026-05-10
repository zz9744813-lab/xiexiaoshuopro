// API: Issue 队列
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { issues } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const allIssues = await db
      .select()
      .from(issues)
      .where(eq(issues.projectId, projectId));

    return NextResponse.json(allIssues);
  } catch (error) {
    console.error("[API] 获取 issues 失败:", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const body = await request.json();
    const {
      scope = "chapter",
      scopeId,
      axis,
      severity = "warning",
      title,
      description,
      evidence,
      proposedFix,
      reviewerAgent,
    } = body;

    const [issue] = await db
      .insert(issues)
      .values({
        projectId,
        scope,
        scopeId,
        axis,
        severity,
        title,
        description,
        evidence,
        proposedFix,
        status: "open",
        reviewerAgent,
      })
      .returning();

    return NextResponse.json(issue, { status: 201 });
  } catch (error) {
    console.error("[API] 创建 issue 失败:", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
