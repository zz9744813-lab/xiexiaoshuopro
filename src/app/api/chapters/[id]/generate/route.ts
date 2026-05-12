// src/app/api/chapters/[id]/generate/route.ts
import { NextRequest } from "next/server"
import { mastra } from "@/mastra"
import { db } from "@/db"
import { chapterVersions, chapters } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chapterId } = await params
  const body = await request.json()
  const { projectId, outline } = body

  const agent = mastra.getAgent("chapterDraft")

  // 1. 开流前 insert 空版本
  const [draftVersion] = await db.insert(chapterVersions).values({
    chapterId,
    contentMd: '',
    source: 'initial',
    versionLabel: `draft-${Date.now()}`,
    createdBy: 'chapterDraft',
  }).returning()
  await db.update(chapters)
    .set({ activeVersionId: draftVersion.id, status: 'drafting' })
    .where(eq(chapters.id, chapterId))

  const result = await agent.stream({
    messages: [{ role: "user", content: outline }],
    runtimeContext: { projectId, chapterId, draftVersionId: draftVersion.id },
  })

  // 2. 包一层 ReadableStream，每 N 字节 flush
  const FLUSH_BYTES = 800
  const FLUSH_INTERVAL_MS = 2000
  let buffer = ''
  let lastFlush = Date.now()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of result.textStream) {
          buffer += chunk
          controller.enqueue(new TextEncoder().encode(chunk))
          if (buffer.length >= FLUSH_BYTES || Date.now() - lastFlush >= FLUSH_INTERVAL_MS) {
            await db.update(chapterVersions)
              .set({ contentMd: buffer })
              .where(eq(chapterVersions.id, draftVersion.id))
            lastFlush = Date.now()
          }
        }
        // 终态 flush
        await db.update(chapterVersions)
          .set({ contentMd: buffer })
          .where(eq(chapterVersions.id, draftVersion.id))
        await db.update(chapters)
          .set({ status: 'drafted' })
          .where(eq(chapters.id, chapterId))
      } catch (err) {
        // abort 路径 flush
        try {
          await db.update(chapterVersions)
            .set({ contentMd: buffer })
            .where(eq(chapterVersions.id, draftVersion.id))
        } catch {}
        throw err
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
