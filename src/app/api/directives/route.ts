import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { worlds } from '@/db/schema';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';
import { applyDirective, type DirectiveType } from '@/lib/simulation/director';

const directiveTypeEnum = z.enum([
  'inject_event',
  'modify_world_state',
  'modify_character_state',
  'add_memory',
  'reveal_information',
  'force_scene',
  'create_branch',
  'lock_fact',
  'adjust_tension',
  'approve_memory_write',
]);

const schema = z.object({
  worldId: z.string().uuid(),
  worldlineId: z.string().uuid(),
  directiveType: directiveTypeEnum,
  mode: z.enum(['soft', 'hard']).default('soft'),
  content: z.record(z.string(), z.unknown()),
  constraints: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten());

    const [world] = await db.select().from(worlds).where(eq(worlds.id, parsed.data.worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    const result = await applyDirective({
      worldId: parsed.data.worldId,
      worldlineId: parsed.data.worldlineId,
      directiveType: parsed.data.directiveType as DirectiveType,
      mode: parsed.data.mode,
      content: parsed.data.content,
      constraints: parsed.data.constraints as
        | { must_not_force_character_reaction?: boolean; preserve_character_autonomy?: boolean }
        | undefined,
      createdBy: 'user',
    });

    return ok(result);
  } catch (e) {
    return serverError('Failed', String(e));
  }
}
