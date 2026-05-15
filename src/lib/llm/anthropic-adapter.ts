/**
 * Anthropic Claude adapter (Messages API).
 */
import type {
  LLMAdapter,
  LLMRequest,
  LLMResponse,
  ModelInfo,
  ProviderCredentials,
} from './types';

export class AnthropicAdapter implements LLMAdapter {
  readonly providerType = 'anthropic';

  constructor(private readonly creds: ProviderCredentials) {}

  private get baseUrl(): string {
    return (this.creds.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '');
  }

  async generate(input: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();

    // Anthropic separates system prompt from messages
    const systemMsg = input.messages.find((m) => m.role === 'system');
    const otherMsgs = input.messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: input.model,
      max_tokens: input.maxTokens ?? 4096,
      messages: otherMsgs.map((m) => ({ role: m.role, content: m.content })),
    };
    if (systemMsg) body.system = systemMsg.content;
    if (input.temperature !== undefined) body.temperature = input.temperature;
    if (input.topP !== undefined) body.top_p = input.topP;

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      input.timeoutMs ?? 60_000,
    );

    let resp: Response;
    try {
      resp = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.creds.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!resp.ok) {
      const text = await resp.text();
      const err = new Error(`Anthropic call failed ${resp.status}: ${text}`);
      (err as Error & { status?: number }).status = resp.status;
      throw err;
    }

    const json = (await resp.json()) as {
      content: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      model?: string;
    };

    const rawText = json.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');

    let parsedJson: unknown = undefined;
    if (input.responseFormat === 'json') {
      try {
        // Try to extract JSON from possible markdown fences
        const stripped = rawText.replace(/```json\n?|```\n?/g, '').trim();
        parsedJson = JSON.parse(stripped);
      } catch {
        parsedJson = undefined;
      }
    }

    return {
      rawText,
      parsedJson,
      tokenInput: json.usage?.input_tokens ?? 0,
      tokenOutput: json.usage?.output_tokens ?? 0,
      latencyMs: Date.now() - start,
      modelReported: json.model,
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      // Anthropic doesn't have a public /models endpoint; do a tiny ping.
      const resp = await this.generate({
        messages: [{ role: 'user', content: 'ping' }],
        model: 'claude-3-5-haiku-latest',
        maxTokens: 1,
        timeoutMs: 10_000,
      });
      return resp.rawText !== undefined;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    // Anthropic doesn't expose /models publicly; return common ones.
    return [
      { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' },
      { id: 'claude-3-opus-latest', name: 'Claude 3 Opus' },
    ];
  }
}
