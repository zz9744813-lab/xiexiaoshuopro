import { NextRequest } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { promptVersions, worlds } from '@/db/schema';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';
import { failValidation } from '@/lib/validation/middleware';

const PROMPT_TYPES = z.enum([
  'character_system',
  'world_agent_system',
  'context_router_template',
  'novelizer_system',
  'memory_summarizer',
  'audit_checker',
  'json_repair',
  'drift_detector',
]);

const createSchema = z.object({
  worldId: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  promptType: PROMPT_TYPES,
  version: z.string().min(1).max(40),
  content: z.string().min(1).max(100000),
  variables: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const worldId = searchParams.get('world_id');
    const promptType = searchParams.get('prompt_type');

    const filters = [];
    if (worldId) {
      const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId));
      if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');
      filters.push(eq(promptVersions.worldId, worldId));
    } else {
      // global prompts (world_id = null) belong to user
      filters.push(eq(promptVersions.ownerUserId, auth.userId));
    }
    if (promptType) filters.push(eq(promptVersions.promptType, promptType));

    const rows = await db
      .select()
      .from(promptVersions)
      .where(and(...filters))
      .orderBy(desc(promptVersions.createdAt));
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
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return failValidation({
        code: 'INVALID_BODY',
        message: issue?.message ?? 'Validation failed',
        field: issue?.path.join('.'),
        constraint: issue?.code,
      });
    }

    if (parsed.data.worldId) {
      const [world] = await db.select().from(worlds).where(eq(worlds.id, parsed.data.worldId));
      if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');
    }

    const [row] = await db
      .insert(promptVersions)
      .values({
        ownerUserId: auth.userId,
        worldId: parsed.data.worldId ?? null,
        name: parsed.data.name,
        promptType: parsed.data.promptType,
        version: parsed.data.version,
        content: parsed.data.content,
        variables: parsed.data.variables ?? {},
        status: 'active',
      })
      .returning();
    return ok(row, 201);
  } catch (e) {
    return serverError('Failed', String(e));
  }
}
