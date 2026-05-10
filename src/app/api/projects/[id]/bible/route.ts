// API: 世界观 Bible (canon_facts + world_entries)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { canonFacts, worldEntries } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "all";

  try {
    const result: { canonFacts?: unknown[]; worldEntries?: unknown[] } = {};

    if (type === "all" || type === "canon") {
      result.canonFacts = await db
        .select()
        .from(canonFacts)
        .where(eq(canonFacts.projectId, projectId));
    }

    if (type === "all" || type === "world") {
      result.worldEntries = await db
        .select()
        .from(worldEntries)
        .where(eq(worldEntries.projectId, projectId));
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] 获取世界观失败:", error);
    return NextResponse.json({ error: "获取世界观失败" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const body = await request.json();
    const { type } = body;

    if (type === "canon") {
      const { fact, category, immutable = false } = body;
      if (!fact) {
        return NextResponse.json({ error: "fact 为必填" }, { status: 400 });
      }
      const [entry] = await db
        .insert(canonFacts)
        .values({ projectId, fact, category, immutable })
        .returning();
      return NextResponse.json(entry, { status: 201 });
    }

    if (type === "world") {
      const { kind, name, description, rules, parentId } = body;
      if (!kind || !name) {
        return NextResponse.json({ error: "kind 和 name 为必填" }, { status: 400 });
      }
      const [entry] = await db
        .insert(worldEntries)
        .values({ projectId, kind, name, description, rules, parentId })
        .returning();
      return NextResponse.json(entry, { status: 201 });
    }

    return NextResponse.json({ error: "type 必须是 canon 或 world" }, { status: 400 });
  } catch (error) {
    console.error("[API] 创建世界观条目失败:", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
