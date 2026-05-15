/**
 * Adapter factory + LLM service entry point.
 * Per spec 24.4 - business logic calls llmService.generate(api_profile_id, messages, options).
 */
import type { LLMAdapter, LLMRequest, LLMResponse, ProviderCredentials } from './types';
import { OpenAICompatibleAdapter } from './openai-adapter';
import { AnthropicAdapter } from './anthropic-adapter';

export function createAdapter(
  providerType: string,
  creds: ProviderCredentials,
): LLMAdapter {
  switch (providerType) {
    case 'anthropic':
      return new AnthropicAdapter(creds);
    case 'openai':
    case 'deepseek':
    case 'mistral':
    case 'openrouter':
    case 'ollama':
    case 'openai_compatible':
      return new OpenAICompatibleAdapter(creds);
    default:
      // Fallback: assume OpenAI-compatible
      return new OpenAICompatibleAdapter(creds);
  }
}

/**
 * Generate a response using the API profile.
 * Caller is responsible for resolving the api_profile_id and providing creds.
 *
 * Note: in real production, llmService should resolve profile/provider from DB
 * and decrypt the API key. For now, this is the lower-level utility.
 */
export async function generateWithAdapter(
  providerType: string,
  creds: ProviderCredentials,
  request: LLMRequest,
): Promise<LLMResponse> {
  const adapter = createAdapter(providerType, creds);
  return adapter.generate(request);
}

export { OpenAICompatibleAdapter, AnthropicAdapter };
export type { LLMAdapter, LLMRequest, LLMResponse, ProviderCredentials };
