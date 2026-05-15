import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { apiProviders } from '@/db/schema';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';
import { STR } from '@/lib/validation/schemas';
import { encryptSecret } from '@/lib/security/crypto';

const createProviderSchema = z.object({
  displayName: STR.providerDisplayName,
  providerType: z.enum([
    'openai', 'anthropic', 'gemini', 'deepseek', 'mistral',
    'openrouter', 'ollama', 'openai_compatible',
  ]),
  baseUrl: STR.baseUrl,
  apiKey: z.string().min(1).max(500),
  isOpenaiCompatible: z.boolean().optional(),
  rateLimitPerMinute: z.number().int().min(1).max(10000).optional(),
  maxConcurrentCalls: z.number().int().min(1).max(100).optional(),
});

export async function GET() {
  try {
    const auth = await getAuthContext();
    const rows = await db
      .select({
        id: apiProviders.id,
        displayName: apiProviders.displayName,
        providerType: apiProviders.providerType,
        baseUrl: apiProviders.baseUrl,
        isOpenaiCompatible: apiProviders.isOpenaiCompatible,
        rateLimitPerMinute: apiProviders.rateLimitPerMinute,
        maxConcurrentCalls: apiProviders.maxConcurrentCalls,
        status: apiProviders.status,
        createdAt: apiProviders.createdAt,
      })
      .from(apiProviders)
      .where(eq(apiProviders.ownerUserId, auth.userId));
    // Note: API key never returned to frontend (spec 33.2)
    return ok(rows);
  } catch (e) {
    return serverError('Failed to list providers', String(e));
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const body = await req.json();
    const parsed = createProviderSchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten());

    const encrypted = encryptSecret(parsed.data.apiKey);

    const [row] = await db
      .insert(apiProviders)
      .values({
        ownerUserId: auth.userId,
        providerType: parsed.data.providerType,
        displayName: parsed.data.displayName,
        baseUrl: parsed.data.baseUrl,
        isOpenaiCompatible: parsed.data.isOpenaiCompatible ?? false,
        rateLimitPerMinute: parsed.data.rateLimitPerMinute,
        maxConcurrentCalls: parsed.data.maxConcurrentCalls ?? 5,
        // Per spec 32.13, secret_id pattern; for MVP we inline encrypted into metadata.
        metadata: { encrypted_api_key: encrypted },
      })
      .returning({
        id: apiProviders.id,
        displayName: apiProviders.displayName,
        providerType: apiProviders.providerType,
        baseUrl: apiProviders.baseUrl,
        status: apiProviders.status,
      });

    return ok(row, 201);
  } catch (e) {
    return serverError('Failed to create provider', String(e));
  }
}
