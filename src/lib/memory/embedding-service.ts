/**
 * Embedding service - resolves the world's embedding_profile and generates
 * embeddings via the corresponding adapter.
 *
 * Per spec 24.5 + 32.18:
 * - Each world binds to one embedding_profile
 * - Memories.embedding dimension must match profile.dimension
 */
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { embeddingProfiles, apiProviders, worlds } from '@/db/schema';
import { decryptSecret, type EncryptedBlob } from '@/lib/security/crypto';

export interface EmbedRequest {
  texts: string[];
  worldId: string;
}

export interface EmbedResult {
  embeddings: number[][];
  dimension: number;
  model: string;
}

/**
 * Calls the OpenAI-compatible /embeddings endpoint.
 * (For Anthropic which has no embedding API, the user should configure an
 *  OpenAI-compatible embedding provider separately.)
 */
async function callOpenAIEmbedding(
  baseUrl: string,
  apiKey: string,
  model: string,
  texts: string[],
): Promise<{ embeddings: number[][]; dimension: number }> {
  const url = `${baseUrl.replace(/\/$/, '')}/embeddings`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!resp.ok) {
    throw new Error(`Embedding call failed ${resp.status}: ${await resp.text()}`);
  }
  const json = (await resp.json()) as {
    data: Array<{ embedding: number[]; index: number }>;
  };
  json.data.sort((a, b) => a.index - b.index);
  const embeddings = json.data.map((d) => d.embedding);
  const dimension = embeddings[0]?.length ?? 0;
  return { embeddings, dimension };
}

export async function embedTexts(req: EmbedRequest): Promise<EmbedResult> {
  if (req.texts.length === 0) {
    return { embeddings: [], dimension: 0, model: '' };
  }

  const [world] = await db.select().from(worlds).where(eq(worlds.id, req.worldId));
  if (!world?.defaultEmbeddingProfileId) {
    throw new Error(`World ${req.worldId} has no embedding profile configured`);
  }

  const [profile] = await db
    .select()
    .from(embeddingProfiles)
    .where(eq(embeddingProfiles.id, world.defaultEmbeddingProfileId));
  if (!profile) throw new Error('Embedding profile not found');
  if (!profile.providerId) throw new Error('Embedding profile has no provider');

  const [provider] = await db
    .select()
    .from(apiProviders)
    .where(eq(apiProviders.id, profile.providerId));
  if (!provider) throw new Error('Provider not found');

  const meta = (provider.metadata as Record<string, unknown>) ?? {};
  const encrypted = meta.encrypted_api_key as EncryptedBlob | undefined;
  if (!encrypted) throw new Error('Provider has no api key');
  const apiKey = decryptSecret(encrypted);

  const baseUrl = provider.baseUrl ?? 'https://api.openai.com/v1';
  const result = await callOpenAIEmbedding(baseUrl, apiKey, profile.model, req.texts);

  if (result.dimension !== profile.dimension) {
    throw new Error(
      `Embedding dim mismatch: profile=${profile.dimension} actual=${result.dimension}. ` +
        `This means the model returned a different dimension than configured. ` +
        `Reconfigure the embedding profile or model.`,
    );
  }

  return { ...result, model: profile.model };
}

/** Convenience for single text */
export async function embedText(text: string, worldId: string): Promise<number[]> {
  const r = await embedTexts({ texts: [text], worldId });
  return r.embeddings[0] ?? [];
}
