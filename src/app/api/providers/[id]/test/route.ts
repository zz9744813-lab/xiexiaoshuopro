import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { apiProviders } from '@/db/schema';
import { ok, notFound, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';
import { decryptSecret, type EncryptedBlob } from '@/lib/security/crypto';
import { createAdapter } from '@/lib/llm';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const auth = await getAuthContext();
    const [provider] = await db
      .select()
      .from(apiProviders)
      .where(and(eq(apiProviders.id, id), eq(apiProviders.ownerUserId, auth.userId)));

    if (!provider) return notFound('Provider not found');

    const meta = (provider.metadata as Record<string, unknown>) ?? {};
    const encrypted = meta.encrypted_api_key as EncryptedBlob | undefined;
    if (!encrypted) {
      return serverError('Provider has no encrypted api key');
    }
    const apiKey = decryptSecret(encrypted);

    const adapter = createAdapter(provider.providerType, {
      apiKey,
      baseUrl: provider.baseUrl ?? undefined,
    });
    const okConn = await adapter.testConnection();
    return ok({ ok: okConn });
  } catch (e) {
    return serverError('Failed to test connection', String(e));
  }
}
