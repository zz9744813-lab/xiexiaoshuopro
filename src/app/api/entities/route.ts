import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { entities, characters, worlds } from '@/db/schema';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';
import {
  STR,
  ENTITY_TYPE_ENUM,
  speechStyleSchema,
  expressionProfileSchema,
  desireProfileSchema,
  abilityProfileSchema,
} from '@/lib/validation/schemas';
import { checkJsonbSize, checkJsonbDepth, failValidation } from '@/lib/validation/middleware';

const characterProfileSchema = z.object({
  publicProfile: z.record(z.string(), z.unknown()).optional(),
  privateProfile: z.record(z.string(), z.unknown()).optional(),
  speechStyle: speechStyleSchema.optional(),
  expressionProfile: expressionProfileSchema.optional(),
  desireProfile: desireProfileSchema.optional(),
  abilityProfile: abilityProfileSchema.optional(),
  initialPrompt: z.string().max(20000).optional(),
});

const createEntitySchema = z.object({
  worldId: z.string().uuid(),
  entityType: ENTITY_TYPE_ENUM,
  name: STR.entityName,
  apiProfileId: z.string().uuid().optional(),
  promptVersionId: z.string().uuid().optional(),
  characterProfile: characterProfileSchema.optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const worldId = searchParams.get('world_id');
    if (!worldId) return badRequest('world_id is required');

    const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId));
    if (!world || world.ownerUserId !== auth.userId) {
      return badRequest('Invalid world');
    }

    const rows = await db
      .select()
      .from(entities)
      .where(eq(entities.worldId, worldId));
    return ok(rows);
  } catch (e) {
    return serverError('Failed to list entities', String(e));
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const body = await req.json();
    const parsed = createEntitySchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return failValidation({
        code: 'INVALID_BODY',
        message: issue?.message ?? 'Validation failed',
        field: issue?.path.join('.'),
        constraint: issue?.code,
      });
    }

    const [world] = await db.select().from(worlds).where(eq(worlds.id, parsed.data.worldId));
    if (!world || world.ownerUserId !== auth.userId) {
      return badRequest('Invalid world');
    }

    // App-level JSONB size & depth checks (spec Appendix A.2 / A.4)
    const cp = parsed.data.characterProfile;
    if (cp) {
      const limits: Array<[string, unknown, number]> = [
        ['publicProfile', cp.publicProfile, 32 * 1024],
        ['privateProfile', cp.privateProfile, 32 * 1024],
        ['speechStyle', cp.speechStyle, 16 * 1024],
        ['expressionProfile', cp.expressionProfile, 16 * 1024],
        ['desireProfile', cp.desireProfile, 16 * 1024],
        ['abilityProfile', cp.abilityProfile, 4 * 1024],
      ];
      for (const [field, value, max] of limits) {
        if (!value) continue;
        const sizeErr = checkJsonbSize({ field, value, maxBytes: max });
        if (sizeErr) return failValidation(sizeErr);
        const depthErr = checkJsonbDepth({ field, value, maxDepth: 6 });
        if (depthErr) return failValidation(depthErr);
      }
    }

    const result = await db.transaction(async (tx) => {
      const [entity] = await tx
        .insert(entities)
        .values({
          worldId: parsed.data.worldId,
          entityType: parsed.data.entityType,
          name: parsed.data.name,
          apiProfileId: parsed.data.apiProfileId,
          promptVersionId: parsed.data.promptVersionId,
        })
        .returning();

      let charRow = null;
      if (parsed.data.entityType === 'character' && cp) {
        [charRow] = await tx
          .insert(characters)
          .values({
            entityId: entity.id,
            publicProfile: cp.publicProfile ?? {},
            privateProfile: cp.privateProfile ?? {},
            speechStyle: cp.speechStyle ?? {},
            expressionProfile: cp.expressionProfile ?? {},
            desireProfile: cp.desireProfile ?? {},
            abilityProfile: cp.abilityProfile ?? {},
            initialPrompt: cp.initialPrompt,
          })
          .returning();
      }

      return { entity, character: charRow };
    });

    return ok(result, 201);
  } catch (e) {
    return serverError('Failed to create entity', String(e));
  }
}
