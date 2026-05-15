/**
 * LLM service - resolves api_profile_id, decrypts API key, dispatches to
 * the right adapter, and records trace + cost.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  apiProfiles,
  apiProviders,
  simulationTraces,
  costLogs,
} from '@/db/schema';
import { decryptSecret, type EncryptedBlob } from '@/lib/security/crypto';
import { createAdapter, type LLMRequest, type LLMResponse } from '@/lib/llm';
import { validateLLMOutput, type SchemaName } from '@/lib/validation/validator';

export interface CallOptions {
  apiProfileId: string;
  worldId: string;
  worldlineId: string;
  sceneId?: string;
  roundId?: string;
  entityId?: string;
  actionId?: string;
  promptVersionId?: string;
  traceType: 'character_call' | 'world_agent_call' | 'novelizer_call' | 'audit' | 'replay';
  phase?: string;
  /** Schema name for output validation (optional) */
  schemaName?: SchemaName;
  /** Input context (saved into trace.input_context) */
  inputContext?: unknown;
}

export interface CallResult {
  response: LLMResponse;
  traceId: string;
  validationOk: boolean;
  validationErrors: string[];
}

export async function callLLM(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  opts: CallOptions,
): Promise<CallResult> {
  const [profile] = await db
    .select()
    .from(apiProfiles)
    .where(eq(apiProfiles.id, opts.apiProfileId));
  if (!profile) throw new Error(`api_profile ${opts.apiProfileId} not found`);

  const [provider] = await db
    .select()
    .from(apiProviders)
    .where(eq(apiProviders.id, profile.providerId));
  if (!provider) throw new Error(`provider ${profile.providerId} not found`);

  const meta = (provider.metadata as Record<string, unknown>) ?? {};
  const encrypted = meta.encrypted_api_key as EncryptedBlob | undefined;
  if (!encrypted) throw new Error('Provider has no encrypted api key');
  const apiKey = decryptSecret(encrypted);

  const adapter = createAdapter(provider.providerType, {
    apiKey,
    baseUrl: provider.baseUrl ?? undefined,
  });

  const req: LLMRequest = {
    messages,
    model: profile.model,
    temperature: profile.temperature ? Number(profile.temperature) : undefined,
    topP: profile.topP ? Number(profile.topP) : undefined,
    maxTokens: profile.maxTokens ?? undefined,
    responseFormat: profile.responseFormat === 'json' ? 'json' : 'text',
    timeoutMs: (profile.timeoutSeconds ?? 60) * 1000,
  };

  let response: LLMResponse | null = null;
  let errorMessage: string | null = null;
  try {
    response = await adapter.generate(req);
  } catch (e) {
    errorMessage = String(e);
  }

  // Validate
  let validationOk = true;
  let validationErrors: string[] = [];
  if (response && opts.schemaName) {
    const v = validateLLMOutput(opts.schemaName, response.parsedJson);
    validationOk = v.ok;
    validationErrors = v.errors;
  }

  // Persist trace (NEVER include raw API key)
  const [trace] = await db
    .insert(simulationTraces)
    .values({
      worldId: opts.worldId,
      worldlineId: opts.worldlineId,
      sceneId: opts.sceneId,
      roundId: opts.roundId,
      entityId: opts.entityId,
      actionId: opts.actionId,
      traceType: opts.traceType,
      phase: opts.phase,
      promptVersionId: opts.promptVersionId,
      apiProfileId: opts.apiProfileId,
      inputContext: (opts.inputContext as Record<string, unknown>) ?? null,
      promptMessages: messages,
      rawOutput: response ? { text: response.rawText } : null,
      parsedOutput: response?.parsedJson ?? null,
      tokenInput: response?.tokenInput,
      tokenOutput: response?.tokenOutput,
      latencyMs: response?.latencyMs,
      status: errorMessage ? 'error' : validationOk ? 'success' : 'schema_error',
      errorMessage: errorMessage ?? (validationOk ? null : validationErrors.join('; ')),
    })
    .returning({ id: simulationTraces.id });

  // Cost log
  if (response && (response.tokenInput || response.tokenOutput)) {
    await db.insert(costLogs).values({
      worldId: opts.worldId,
      worldlineId: opts.worldlineId,
      sceneId: opts.sceneId,
      roundId: opts.roundId,
      entityId: opts.entityId,
      apiProfileId: opts.apiProfileId,
      traceId: trace.id,
      tokenInput: response.tokenInput,
      tokenOutput: response.tokenOutput,
      phase: opts.phase,
      // Cost calc could be added per provider/model rate card
      costUsd: '0',
    });
  }

  if (errorMessage) throw new Error(errorMessage);

  return {
    response: response!,
    traceId: trace.id,
    validationOk,
    validationErrors,
  };
}
