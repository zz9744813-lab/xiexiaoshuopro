/**
 * OpenAI-compatible adapter.
 * Works with OpenAI, DeepSeek, OpenRouter, Mistral, Ollama (with /v1 path)
 * and any custom OpenAI-compatible endpoint.
 */
import type {
  LLMAdapter,
  LLMRequest,
  LLMResponse,
  ModelInfo,
  ProviderCredentials,
} from './types';

export class OpenAICompatibleAdapter implements LLMAdapter {
  readonly providerType = 'openai_compatible';

  constructor(private readonly creds: ProviderCredentials) {}

  private get baseUrl(): string {
    return (this.creds.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  }

  async generate(input: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();
    const body: Record<string, unknown> = {
      model: input.model,
      messages: input.messages,
    };
    if (input.temperature !== undefined) body.temperature = input.temperature;
    if (input.topP !== undefined) body.top_p = input.topP;
    if (input.maxTokens !== undefined) body.max_tokens = input.maxTokens;
    if (input.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      input.timeoutMs ?? 60_000,
    );

    let resp: Response;
    try {
      resp = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.creds.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!resp.ok) {
      const text = await resp.text();
      const err = new Error(`LLM call failed ${resp.status}: ${text}`);
      // Attach status for retry logic
      (err as Error & { status?: number }).status = resp.status;
      throw err;
    }

    const json = (await resp.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };

    const rawText = json.choices?.[0]?.message?.content ?? '';
    let parsedJson: unknown = undefined;
    if (input.responseFormat === 'json') {
      try {
        parsedJson = JSON.parse(rawText);
      } catch {
        parsedJson = undefined;
      }
    }

    return {
      rawText,
      parsedJson,
      tokenInput: json.usage?.prompt_tokens ?? 0,
      tokenOutput: json.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - start,
      modelReported: json.model,
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.creds.apiKey}` },
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const resp = await fetch(`${this.baseUrl}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.creds.apiKey}` },
    });
    if (!resp.ok) return [];
    const json = (await resp.json()) as { data?: Array<{ id: string }> };
    return (json.data ?? []).map((m) => ({ id: m.id, name: m.id }));
  }
}
