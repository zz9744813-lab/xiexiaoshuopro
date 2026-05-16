import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { novelChapters, worlds } from '@/db/schema';
import { ok, badRequest, notFound, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const auth = await getAuthContext();
    const [row] = await db.select().from(novelChapters).where(eq(novelChapters.id, id));
    if (!row) return notFound('Chapter not found');
    const [world] = await db.select().from(worlds).where(eq(worlds.id, row.worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');
    return ok(row);
  } catch (e) {
    return serverError('Failed', String(e));
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const auth = await getAuthContext();
    const body = (await req.json()) as { status?: string; title?: string; contentMarkdown?: string };

    const [row] = await db.select().from(novelChapters).where(eq(novelChapters.id, id));
    if (!row) return notFound('Chapter not found');
    const [world] = await db.select().from(worlds).where(eq(worlds.id, row.worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (body.status && ['draft', 'reviewing', 'published', 'archived'].includes(body.status)) {
      update.status = body.status;
    }
    if (typeof body.title === 'string' && body.title.length > 0 && body.title.length <= 200) {
      update.title = body.title;
    }
    if (typeof body.contentMarkdown === 'string' && body.contentMarkdown.length <= 100000) {
      update.contentMarkdown = body.contentMarkdown;
    }

    const [updated] = await db
      .update(novelChapters)
      .set(update)
      .where(eq(novelChapters.id, id))
      .returning();
    return ok(updated);
  } catch (e) {
    return serverError('Failed', String(e));
  }
}
