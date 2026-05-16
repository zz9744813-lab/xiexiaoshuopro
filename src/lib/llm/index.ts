/**
 * Adapter factory + LLM service entry point.
 * Per spec 24.4 - business logic calls llmService.generate(api_profile_id, ...) - never
 * call_openai() / call_claude() / call_gemini() directly.
 */
import type { LLMAdapter, LLMRequest, LLMResponse, ProviderCredentials } from './types';
import { OpenAICompatibleAdapter } from './openai-adapter';
import { AnthropicAdapter } from './anthropic-adapter';
import { MockAdapter } from './mock-adapter';

export function createAdapter(
  providerType: string,
  creds: ProviderCredentials,
): LLMAdapter {
  switch (providerType) {
    case 'mock':
      return new MockAdapter(creds);
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
      return new OpenAICompatibleAdapter(creds);
  }
}

export async function generateWithAdapter(
  providerType: string,
  creds: ProviderCredentials,
  request: LLMRequest,
): Promise<LLMResponse> {
  const adapter = createAdapter(providerType, creds);
  return adapter.generate(request);
}

export { OpenAICompatibleAdapter, AnthropicAdapter, MockAdapter };
export type { LLMAdapter, LLMRequest, LLMResponse, ProviderCredentials };
