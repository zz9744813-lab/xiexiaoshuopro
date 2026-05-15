import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { entities, characters, worlds } from '@/db/schema';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';
import {
  STR,
  ENTITY_TYPE_ENUM,
  abilityValueSchema,
  jsonbSizeAtMost,
  jsonDepthAtMost,
  sampleLinesSchema,
  forbiddenPhrasesSchema,
} from '@/lib/validation/schemas';

const characterProfileSchema = z.object({
  publicProfile: z.record(z.string(), z.unknown()).optional(),
  privateProfile: z.record(z.string(), z.unknown()).optional(),
  speechStyle: z
    .object({
      sentence_length: z.string().optional(),
      traits: z.array(z.string()).max(20).optional(),
      forbidden_style: z.array(z.string()).max(20).optional(),
      forbidden_phrases: forbiddenPhrasesSchema.optional(),
      sample_lines: sampleLinesSchema.optional(),
    })
    .optional(),
  expressionProfile: z.record(z.string(), z.unknown()).optional(),
  desireProfile: z.record(z.string(), z.unknown()).optional(),
  abilityProfile: z
    .object({
      perception: abilityValueSchema.optional(),
      stealth: abilityValueSchema.optional(),
      social_insight: abilityValueSchema.optional(),
      combat: abilityValueSchema.optional(),
      mobility: abilityValueSchema.optional(),
    })
    .optional(),
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

    // Verify world ownership
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
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten());

    // Verify world ownership
    const [world] = await db.select().from(worlds).where(eq(worlds.id, parsed.data.worldId));
    if (!world || world.ownerUserId !== auth.userId) {
      return badRequest('Invalid world');
    }

    // App-level JSONB size & depth checks (Appendix A.2 / A.4)
    const cp = parsed.data.characterProfile;
    if (cp) {
      for (const [key, limit] of [
        ['publicProfile', 32 * 1024],
        ['privateProfile', 32 * 1024],
        ['speechStyle', 16 * 1024],
        ['expressionProfile', 16 * 1024],
        ['desireProfile', 16 * 1024],
        ['abilityProfile', 4 * 1024],
      ] as const) {
        const v = (cp as Record<string, unknown>)[key];
        if (v && !jsonbSizeAtMost(v, limit)) {
          return badRequest(`${key} exceeds ${limit} bytes`);
        }
        if (v && !jsonDepthAtMost(v, 6)) {
          return badRequest(`${key} JSON nesting > 6`);
        }
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
