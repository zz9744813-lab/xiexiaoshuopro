import { NextRequest } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { worlds, worldlines } from '@/db/schema';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';
import { STR } from '@/lib/validation/schemas';

const createWorldSchema = z.object({
  name: STR.worldName,
  description: STR.worldDescription,
  genre: z.string().max(80).optional(),
});

export async function GET() {
  try {
    const auth = await getAuthContext();
    const rows = await db
      .select()
      .from(worlds)
      .where(and(eq(worlds.ownerUserId, auth.userId), isNull(worlds.deletedAt)));
    return ok(rows);
  } catch (e) {
    return serverError('Failed to list worlds', String(e));
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const body = await req.json();
    const parsed = createWorldSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Invalid input', parsed.error.flatten());
    }

    // Create world + default main worldline atomically
    const result = await db.transaction(async (tx) => {
      const [world] = await tx
        .insert(worlds)
        .values({
          name: parsed.data.name,
          description: parsed.data.description,
          genre: parsed.data.genre,
          ownerUserId: auth.userId,
        })
        .returning();

      const [worldline] = await tx
        .insert(worldlines)
        .values({
          worldId: world.id,
          name: 'main',
          status: 'active',
        })
        .returning();

      const [updated] = await tx
        .update(worlds)
        .set({ defaultWorldlineId: worldline.id })
        .where(eq(worlds.id, world.id))
        .returning();

      return { world: updated, worldline };
    });

    return ok(result, 201);
  } catch (e) {
    return serverError('Failed to create world', String(e));
  }
}
