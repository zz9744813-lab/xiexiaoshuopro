import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { novelChapters, worlds } from '@/db/schema';
import { badRequest, notFound, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';

// GET /api/chapters/[id]/export - returns Markdown as text/markdown
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const auth = await getAuthContext();
    const [row] = await db.select().from(novelChapters).where(eq(novelChapters.id, id));
    if (!row) return notFound('Chapter not found');
    const [world] = await db.select().from(worlds).where(eq(worlds.id, row.worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    const md = `# ${row.title}\n\n${row.contentMarkdown}\n\n---\n\n*忠实度: ${row.faithfulnessScore ?? '-'}*\n`;
    const safeTitle = (row.title || `chapter-${row.chapterIndex}`).replace(/[\\/:*?"<>|]/g, '_');

    return new Response(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeTitle)}.md`,
      },
    });
  } catch (e) {
    return serverError('Failed', String(e));
  }
}
