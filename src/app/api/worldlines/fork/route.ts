import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { worlds, worldlines } from '@/db/schema';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';
import { forkWorldline } from '@/lib/simulation/worldline-fork';

const forkSchema = z.object({
  worldId: z.string().uuid(),
  parentWorldlineId: z.string().uuid(),
  name: z.string().min(1).max(80),
  branchReason: z.string().max(500).optional(),
  sceneId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const body = await req.json();
    const parsed = forkSchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten());

    const [world] = await db.select().from(worlds).where(eq(worlds.id, parsed.data.worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    const [parent] = await db
      .select()
      .from(worldlines)
      .where(eq(worldlines.id, parsed.data.parentWorldlineId));
    if (!parent || parent.worldId !== parsed.data.worldId) {
      return badRequest('Invalid parent worldline');
    }

    const result = await forkWorldline(parsed.data);
    return ok(result, 201);
  } catch (e) {
    return serverError('Fork failed', String(e));
  }
}
