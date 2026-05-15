import { NextRequest } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { worlds } from '@/db/schema';
import { ok, notFound, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const auth = await getAuthContext();
    const [row] = await db
      .select()
      .from(worlds)
      .where(
        and(
          eq(worlds.id, id),
          eq(worlds.ownerUserId, auth.userId),
          isNull(worlds.deletedAt),
        ),
      );
    if (!row) return notFound('World not found');
    return ok(row);
  } catch (e) {
    return serverError('Failed to get world', String(e));
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const auth = await getAuthContext();
    const [row] = await db
      .update(worlds)
      .set({ deletedAt: new Date() })
      .where(and(eq(worlds.id, id), eq(worlds.ownerUserId, auth.userId)))
      .returning();
    if (!row) return notFound('World not found');
    return ok({ deleted: true });
  } catch (e) {
    return serverError('Failed to delete world', String(e));
  }
}
