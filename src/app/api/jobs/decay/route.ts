import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { worlds } from '@/db/schema';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';
import { runDecayJob } from '@/lib/memory/decay-job';

const schema = z.object({
  worldId: z.string().uuid(),
  worldlineId: z.string().uuid().optional(),
  currentWorldDay: z.number().int().min(0).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten());

    const [world] = await db.select().from(worlds).where(eq(worlds.id, parsed.data.worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    const result = await runDecayJob(parsed.data);
    return ok(result);
  } catch (e) {
    return serverError('Failed', String(e));
  }
}
