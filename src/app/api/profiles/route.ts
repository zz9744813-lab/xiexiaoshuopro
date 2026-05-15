import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { apiProfiles, apiProviders } from '@/db/schema';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';
import {
  STR,
  temperatureSchema,
  topPSchema,
  maxTokensSchema,
  timeoutSecondsSchema,
  costLimitSchema,
} from '@/lib/validation/schemas';

const createProfileSchema = z.object({
  providerId: z.string().uuid(),
  name: STR.profileName,
  model: STR.modelName,
  temperature: temperatureSchema.optional(),
  topP: topPSchema.optional(),
  maxTokens: maxTokensSchema.optional(),
  responseFormat: z.enum(['json', 'text']).optional(),
  timeoutSeconds: timeoutSecondsSchema.optional(),
  retryCount: z.number().int().min(0).max(10).optional(),
  fallbackApiProfileId: z.string().uuid().optional(),
  costLimitPerCall: costLimitSchema.optional(),
  costLimitPerRun: costLimitSchema.optional(),
  costLimitPerDay: costLimitSchema.optional(),
});

export async function GET() {
  try {
    const auth = await getAuthContext();
    const rows = await db
      .select()
      .from(apiProfiles)
      .where(eq(apiProfiles.ownerUserId, auth.userId));
    return ok(rows);
  } catch (e) {
    return serverError('Failed to list profiles', String(e));
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const body = await req.json();
    const parsed = createProfileSchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten());

    // Verify provider ownership
    const [provider] = await db
      .select()
      .from(apiProviders)
      .where(eq(apiProviders.id, parsed.data.providerId));
    if (!provider || provider.ownerUserId !== auth.userId) {
      return badRequest('Invalid provider');
    }

    const [row] = await db
      .insert(apiProfiles)
      .values({
        providerId: parsed.data.providerId,
        ownerUserId: auth.userId,
        name: parsed.data.name,
        model: parsed.data.model,
        temperature: parsed.data.temperature?.toString(),
        topP: parsed.data.topP?.toString(),
        maxTokens: parsed.data.maxTokens,
        responseFormat: parsed.data.responseFormat,
        timeoutSeconds: parsed.data.timeoutSeconds ?? 60,
        retryCount: parsed.data.retryCount ?? 2,
        fallbackApiProfileId: parsed.data.fallbackApiProfileId,
        costLimitPerCall: parsed.data.costLimitPerCall?.toString(),
        costLimitPerRun: parsed.data.costLimitPerRun?.toString(),
        costLimitPerDay: parsed.data.costLimitPerDay?.toString(),
      })
      .returning();

    return ok(row, 201);
  } catch (e) {
    return serverError('Failed to create profile', String(e));
  }
}
