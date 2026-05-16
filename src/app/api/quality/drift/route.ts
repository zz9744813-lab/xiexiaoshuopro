import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { worlds, entities } from '@/db/schema';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';
import { detectCharacterDrift } from '@/lib/simulation/drift-detector';

const schema = z.object({
  worldId: z.string().uuid(),
  worldlineId: z.string().uuid(),
  entityId: z.string().uuid().optional(),
  recentN: z.number().int().min(1).max(50).optional(),
});

// POST /api/quality/drift - check drift for one entity or all characters
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten());

    const [world] = await db.select().from(worlds).where(eq(worlds.id, parsed.data.worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    if (parsed.data.entityId) {
      const r = await detectCharacterDrift({
        worldId: parsed.data.worldId,
        worldlineId: parsed.data.worldlineId,
        entityId: parsed.data.entityId,
        recentN: parsed.data.recentN,
      });
      return ok([r]);
    }

    // All characters
    const allCharacters = await db
      .select()
      .from(entities)
      .where(eq(entities.worldId, parsed.data.worldId));
    const reports = await Promise.all(
      allCharacters
        .filter((e) => e.entityType === 'character')
        .map((e) =>
          detectCharacterDrift({
            worldId: parsed.data.worldId,
            worldlineId: parsed.data.worldlineId,
            entityId: e.id,
            recentN: parsed.data.recentN,
          }),
        ),
    );
    return ok(reports);
  } catch (e) {
    return serverError('Failed', String(e));
  }
}
