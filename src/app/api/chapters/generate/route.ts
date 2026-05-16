import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { worlds } from '@/db/schema';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';
import { generateChapter } from '@/lib/simulation/narrator-service';

const schema = z.object({
  worldId: z.string().uuid(),
  worldlineId: z.string().uuid(),
  sourceEventIds: z.array(z.string().uuid()).min(1).max(200),
  sourceSceneIds: z.array(z.string().uuid()).max(50).optional(),
  narratorEntityId: z.string().uuid().optional(),
  apiProfileId: z.string().uuid().optional(),
  pov: z.enum(['first_person', 'third_person_limited', 'third_person_omniscient']).optional(),
  styleProfile: z.record(z.string(), z.unknown()).optional(),
  title: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten());

    const [world] = await db.select().from(worlds).where(eq(worlds.id, parsed.data.worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    const result = await generateChapter(parsed.data);
    return ok(result, 201);
  } catch (e) {
    return serverError('Generation failed', String(e));
  }
}
