/**
 * Unified LLM adapter interface per spec 24.4.
 * Business logic must call llmService.generate(api_profile_id, ...) - never
 * call_openai() / call_claude() / call_gemini() directly.
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  model: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
  timeoutMs?: number;
}

export interface LLMResponse {
  rawText: string;
  parsedJson?: unknown;
  tokenInput: number;
  tokenOutput: number;
  costUsd?: number;
  latencyMs: number;
  modelReported?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
}

export interface LLMAdapter {
  /** Returns provider type name e.g. 'openai' | 'anthropic' */
  readonly providerType: string;
  generate(input: LLMRequest): Promise<LLMResponse>;
  testConnection(): Promise<boolean>;
  listModels(): Promise<ModelInfo[]>;
}

export interface ProviderCredentials {
  baseUrl?: string;
  apiKey: string;
  isOpenaiCompatible?: boolean;
  metadata?: Record<string, unknown>;
}
