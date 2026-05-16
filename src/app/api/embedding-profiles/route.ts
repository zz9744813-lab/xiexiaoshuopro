import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { embeddingProfiles, worlds, apiProviders } from '@/db/schema';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';

const createSchema = z.object({
  worldId: z.string().uuid(),
  providerId: z.string().uuid(),
  name: z.string().min(1).max(80),
  model: z.string().min(1).max(200),
  dimension: z.number().int().min(64).max(8192),
  distanceMetric: z.enum(['cosine', 'l2', 'inner_product']).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const worldId = searchParams.get('world_id');
    if (!worldId) return badRequest('world_id is required');
    const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    const rows = await db
      .select()
      .from(embeddingProfiles)
      .where(eq(embeddingProfiles.worldId, worldId));
    return ok(rows);
  } catch (e) {
    return serverError('Failed', String(e));
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten());

    const [world] = await db.select().from(worlds).where(eq(worlds.id, parsed.data.worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    const [provider] = await db
      .select()
      .from(apiProviders)
      .where(eq(apiProviders.id, parsed.data.providerId));
    if (!provider || provider.ownerUserId !== auth.userId) {
      return badRequest('Invalid provider');
    }

    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(embeddingProfiles)
        .values({
          ownerUserId: auth.userId,
          worldId: parsed.data.worldId,
          providerId: parsed.data.providerId,
          name: parsed.data.name,
          model: parsed.data.model,
          dimension: parsed.data.dimension,
          distanceMetric: parsed.data.distanceMetric ?? 'cosine',
        })
        .returning();

      // Per spec 32.18 - bind world to this embedding profile
      await tx
        .update(worlds)
        .set({ defaultEmbeddingProfileId: row.id })
        .where(eq(worlds.id, parsed.data.worldId));

      return row;
    });
    return ok(result, 201);
  } catch (e) {
    return serverError('Failed', String(e));
  }
}
