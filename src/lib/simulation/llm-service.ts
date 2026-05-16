/**
 * LLM service - resolves api_profile_id, decrypts API key, dispatches to
 * the right adapter, and records trace + cost.
 *
 * Per spec § 25 - applies budget checks BEFORE each call and triggers
 * fallback / pause / abort according to entity importance.
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
import { estimateCost } from '@/lib/llm/pricing';
import { checkBudget, type BudgetStatus } from './budget';
import { publishEvent } from '@/lib/events/event-bus';

export interface CallOptions {
  apiProfileId: string;
  worldId: string;
  worldlineId: string;
  sceneId?: string;
  roundId?: string;
  entityId?: string;
  actionId?: string;
  promptVersionId?: string;
  traceType:
    | 'character_call'
    | 'world_agent_call'
    | 'novelizer_call'
    | 'audit'
    | 'replay'
    | 'memory_retrieval';
  phase?: string;
  /** Schema name for output validation (optional) */
  schemaName?: SchemaName;
  /** Input context (saved into trace.input_context) */
  inputContext?: unknown;
  /**
   * Budget enforcement strategy when this call would push budget over limit.
   *  - 'pause' (default for main characters / world_agent): throw BudgetExceededError
   *  - 'fallback': try profile.fallback_api_profile_id once
   *  - 'degrade': proceed but caller should have shrunk context already
   *  - 'abort': also throws BudgetExceededError
   */
  onExceed?: 'pause' | 'fallback' | 'degrade' | 'abort';
  /** AbortSignal to cancel the call (used by pause/abort - spec § 21.6) */
  signal?: AbortSignal;
}

export interface CallResult {
  response: LLMResponse;
  traceId: string;
  validationOk: boolean;
  validationErrors: string[];
  budgetStatuses: BudgetStatus[];
  usedFallbackProfileId?: string;
}

export class BudgetExceededError extends Error {
  statuses: BudgetStatus[];
  constructor(statuses: BudgetStatus[]) {
    super(
      `Budget exceeded: ${statuses
        .filter((s) => s.exceeded)
        .map((s) => `${s.scope}=${s.used.toFixed(4)}/${s.limit}`)
        .join(', ')}`,
    );
    this.statuses = statuses;
  }
}

async function loadProviderApiKey(providerId: string): Promise<{
  providerType: string;
  baseUrl: string | null;
  apiKey: string;
  metadata: Record<string, unknown>;
}> {
  const [provider] = await db.select().from(apiProviders).where(eq(apiProviders.id, providerId));
  if (!provider) throw new Error(`provider ${providerId} not found`);

  const meta = (provider.metadata as Record<string, unknown>) ?? {};

  // Mock provider doesn't need a real API key
  if (provider.providerType === 'mock') {
    return {
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      apiKey: 'mock',
      metadata: meta,
    };
  }

  const encrypted = meta.encrypted_api_key as EncryptedBlob | undefined;
  if (!encrypted) throw new Error('Provider has no encrypted api key');
  const apiKey = decryptSecret(encrypted);
  return {
    providerType: provider.providerType,
    baseUrl: provider.baseUrl,
    apiKey,
    metadata: meta,
  };
}

export async function callLLM(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  opts: CallOptions,
): Promise<CallResult> {
  // 1. Pre-call budget check (spec § 25.2)
  const budgetStatuses = await checkBudget({
    apiProfileId: opts.apiProfileId,
    worldId: opts.worldId,
    roundId: opts.roundId,
    sceneId: opts.sceneId,
  });

  let usedFallbackProfileId: string | undefined;
  let activeProfileId = opts.apiProfileId;

  if (budgetStatuses.some((s) => s.exceeded)) {
    const action = opts.onExceed ?? 'pause';

    publishEvent('cost.budget.exceeded', {
      worldId: opts.worldId,
      worldlineId: opts.worldlineId,
      sceneId: opts.sceneId,
      roundId: opts.roundId,
      entityId: opts.entityId,
      data: { statuses: budgetStatuses, action },
    });

    if (action === 'pause' || action === 'abort') {
      throw new BudgetExceededError(budgetStatuses);
    }
    if (action === 'fallback') {
      const [profile] = await db
        .select()
        .from(apiProfiles)
        .where(eq(apiProfiles.id, opts.apiProfileId));
      if (profile?.fallbackApiProfileId && profile.fallbackApiProfileId !== opts.apiProfileId) {
        activeProfileId = profile.fallbackApiProfileId;
        usedFallbackProfileId = profile.fallbackApiProfileId;
      } else {
        // No fallback configured - degrade to pause
        throw new BudgetExceededError(budgetStatuses);
      }
    }
    // 'degrade' falls through and proceeds with the original profile
  } else if (budgetStatuses.some((s) => s.warning)) {
    publishEvent('cost.budget.warning', {
      worldId: opts.worldId,
      worldlineId: opts.worldlineId,
      sceneId: opts.sceneId,
      roundId: opts.roundId,
      entityId: opts.entityId,
      data: { statuses: budgetStatuses },
    });
  }

  // 2. Resolve profile + provider + creds
  const [profile] = await db.select().from(apiProfiles).where(eq(apiProfiles.id, activeProfileId));
  if (!profile) throw new Error(`api_profile ${activeProfileId} not found`);

  const creds = await loadProviderApiKey(profile.providerId);

  const adapter = createAdapter(creds.providerType, {
    apiKey: creds.apiKey,
    baseUrl: creds.baseUrl ?? undefined,
    metadata: creds.metadata,
  });

  // Honor caller-supplied AbortSignal for in-flight pause / abort
  if (opts.signal?.aborted) {
    throw new Error('Aborted before call');
  }

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

  // Race with abort signal
  if (opts.signal) {
    try {
      response = await new Promise<LLMResponse>((resolve, reject) => {
        const onAbort = () => reject(new Error('Aborted during call'));
        opts.signal!.addEventListener('abort', onAbort, { once: true });
        adapter
          .generate(req)
          .then((r) => {
            opts.signal!.removeEventListener('abort', onAbort);
            resolve(r);
          })
          .catch((e) => {
            opts.signal!.removeEventListener('abort', onAbort);
            reject(e);
          });
      });
    } catch (e) {
      errorMessage = String(e);
    }
  } else {
    try {
      response = await adapter.generate(req);
    } catch (e) {
      errorMessage = String(e);
    }
  }

  // 3. Schema validation
  let validationOk = true;
  let validationErrors: string[] = [];
  if (response && opts.schemaName) {
    const v = validateLLMOutput(opts.schemaName, response.parsedJson);
    validationOk = v.ok;
    validationErrors = v.errors;
  }

  // 4. Estimate USD cost
  const tokenIn = response?.tokenInput ?? 0;
  const tokenOut = response?.tokenOutput ?? 0;
  const costUsd = response
    ? estimateCost({
        providerType: creds.providerType,
        model: profile.model,
        tokenInput: tokenIn,
        tokenOutput: tokenOut,
      })
    : 0;

  // 5. Persist trace (NEVER include raw API key)
  const traceStatus = errorMessage
    ? errorMessage.includes('Abort')
      ? 'aborted'
      : 'error'
    : validationOk
      ? 'success'
      : 'schema_error';

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
      apiProfileId: activeProfileId,
      inputContext: (opts.inputContext as Record<string, unknown>) ?? null,
      promptMessages: messages,
      rawOutput: response ? { text: response.rawText } : null,
      parsedOutput: response?.parsedJson ?? null,
      tokenInput: tokenIn,
      tokenOutput: tokenOut,
      costEstimate: costUsd.toFixed(6),
      latencyMs: response?.latencyMs,
      status: traceStatus,
      errorMessage:
        errorMessage ?? (validationOk ? null : validationErrors.join('; ')),
    })
    .returning({ id: simulationTraces.id });

  // 6. Cost log
  if (response && (tokenIn > 0 || tokenOut > 0 || costUsd > 0)) {
    await db.insert(costLogs).values({
      worldId: opts.worldId,
      worldlineId: opts.worldlineId,
      sceneId: opts.sceneId,
      roundId: opts.roundId,
      entityId: opts.entityId,
      apiProfileId: activeProfileId,
      traceId: trace.id,
      tokenInput: tokenIn,
      tokenOutput: tokenOut,
      phase: opts.phase,
      costUsd: costUsd.toFixed(6),
    });
  }

  if (errorMessage) throw new Error(errorMessage);

  return {
    response: response!,
    traceId: trace.id,
    validationOk,
    validationErrors,
    budgetStatuses,
    usedFallbackProfileId,
  };
}
