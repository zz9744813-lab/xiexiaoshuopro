/**
 * LLM call with retry, fallback, and rate-limit handling.
 * Per spec 21.x and Appendix B.4.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { apiProfiles } from '@/db/schema';
import { callLLM, type CallOptions, type CallResult } from './llm-service';
import type { LLMMessage } from '@/lib/llm/types';

export type FailureType =
  | 'api_timeout'
  | 'api_invalid_json'
  | 'api_refusal'
  | 'api_empty'
  | 'provider_error'
  | 'schema_error'
  | 'rate_limited'
  | 'unknown';

function classifyError(err: unknown): FailureType {
  const e = err as { status?: number; message?: string; name?: string };
  if (e?.name === 'AbortError') return 'api_timeout';
  if (e?.status === 429) return 'rate_limited';
  if (typeof e?.status === 'number' && e.status >= 500) return 'provider_error';
  if (typeof e?.message === 'string' && /timeout/i.test(e.message)) return 'api_timeout';
  return 'unknown';
}

export interface RetryOptions extends CallOptions {
  /** Override retry_count from profile */
  maxRetries?: number;
  /** Cap exponential backoff */
  maxBackoffMs?: number;
}

export interface RetryResult {
  result: CallResult | null;
  finalError: string | null;
  attempts: Array<{
    apiProfileId: string;
    attempt: number;
    error?: string;
    failureType?: FailureType;
    success?: boolean;
  }>;
  usedFallback: boolean;
}

const DEFAULT_BACKOFF_BASE = 1200;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Per Appendix B.4 + spec 21.7:
 *  - network_error / 5xx: exponential backoff up to retry_count
 *  - rate_limited: respect Retry-After / exponential backoff; 5+ accumulated → switch to fallback
 *  - api_invalid_json: json_repair prompt once (NOT implemented in MVP); else schema_error
 *  - api_refusal: no retry, switch fallback
 *  - api_timeout: no retry on same profile, switch fallback
 */
export async function callLLMWithRetry(
  messages: LLMMessage[],
  options: RetryOptions,
): Promise<RetryResult> {
  const attempts: RetryResult['attempts'] = [];
  let usedFallback = false;
  let currentProfileId = options.apiProfileId;
  let rateLimitedCount = 0;
  let finalError: string | null = null;

  while (true) {
    const [profile] = await db
      .select()
      .from(apiProfiles)
      .where(eq(apiProfiles.id, currentProfileId));
    if (!profile) {
      finalError = `api_profile ${currentProfileId} not found`;
      break;
    }

    const maxRetries = options.maxRetries ?? profile.retryCount ?? 2;
    const maxBackoff = options.maxBackoffMs ?? 30_000;

    let lastFailure: FailureType | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await callLLM(messages, { ...options, apiProfileId: currentProfileId });

        // schema_error counts as failure for retry logic
        if (!result.validationOk) {
          attempts.push({
            apiProfileId: currentProfileId,
            attempt,
            failureType: 'schema_error',
            error: result.validationErrors.join('; '),
          });
          lastFailure = 'schema_error';
          // schema errors: per spec App C.4 - 3x for character, 2x for world; we use maxRetries
          if (attempt >= maxRetries) break;
          await sleep(Math.min(DEFAULT_BACKOFF_BASE * 2 ** attempt, maxBackoff));
          continue;
        }

        attempts.push({ apiProfileId: currentProfileId, attempt, success: true });
        return { result, finalError: null, attempts, usedFallback };
      } catch (e) {
        const failureType = classifyError(e);
        lastFailure = failureType;
        attempts.push({
          apiProfileId: currentProfileId,
          attempt,
          failureType,
          error: String(e),
        });

        if (failureType === 'rate_limited') {
          rateLimitedCount++;
          if (rateLimitedCount >= 5) break; // switch to fallback
          await sleep(Math.min(DEFAULT_BACKOFF_BASE * 2 ** attempt, maxBackoff));
          continue;
        }
        if (failureType === 'api_timeout' || failureType === 'api_refusal') {
          // No retry on same profile
          break;
        }
        if (failureType === 'provider_error' || failureType === 'unknown') {
          if (attempt >= maxRetries) break;
          await sleep(Math.min(DEFAULT_BACKOFF_BASE * 2 ** attempt, maxBackoff));
          continue;
        }
      }
    }

    // Switch to fallback if available
    if (profile.fallbackApiProfileId && profile.fallbackApiProfileId !== currentProfileId) {
      currentProfileId = profile.fallbackApiProfileId;
      usedFallback = true;
      rateLimitedCount = 0;
      continue;
    }

    finalError = lastFailure ?? 'final_failure';
    break;
  }

  return { result: null, finalError, attempts, usedFallback };
}
