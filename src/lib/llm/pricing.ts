/**
 * Static rate card for cost estimation (USD per 1M tokens).
 * Per spec § 25.1 - per_round/scene/day budgets need real cost estimation.
 *
 * Numbers are approximate as of 2024-2025; update as needed. Prices in USD per
 * 1,000,000 tokens unless noted.
 *
 * For unknown models we use a conservative fallback so we don't accidentally
 * under-bill. Always prefer adding the model explicitly.
 */

export interface ModelRate {
  inputPerMTok: number;
  outputPerMTok: number;
}

const DEFAULT_FALLBACK: ModelRate = { inputPerMTok: 5, outputPerMTok: 15 };

const RATES: Record<string, ModelRate> = {
  // OpenAI
  'gpt-4o': { inputPerMTok: 2.5, outputPerMTok: 10 },
  'gpt-4o-mini': { inputPerMTok: 0.15, outputPerMTok: 0.6 },
  'gpt-4.1': { inputPerMTok: 2.5, outputPerMTok: 10 },
  'gpt-4.1-mini': { inputPerMTok: 0.4, outputPerMTok: 1.6 },
  'gpt-4.1-nano': { inputPerMTok: 0.1, outputPerMTok: 0.4 },
  'gpt-3.5-turbo': { inputPerMTok: 0.5, outputPerMTok: 1.5 },
  'text-embedding-3-small': { inputPerMTok: 0.02, outputPerMTok: 0 },
  'text-embedding-3-large': { inputPerMTok: 0.13, outputPerMTok: 0 },

  // Anthropic
  'claude-3-5-sonnet-latest': { inputPerMTok: 3, outputPerMTok: 15 },
  'claude-3-5-sonnet-20241022': { inputPerMTok: 3, outputPerMTok: 15 },
  'claude-3-5-haiku-latest': { inputPerMTok: 0.8, outputPerMTok: 4 },
  'claude-3-opus-latest': { inputPerMTok: 15, outputPerMTok: 75 },
  'claude-3-haiku-20240307': { inputPerMTok: 0.25, outputPerMTok: 1.25 },

  // DeepSeek
  'deepseek-chat': { inputPerMTok: 0.27, outputPerMTok: 1.1 },
  'deepseek-reasoner': { inputPerMTok: 0.55, outputPerMTok: 2.19 },

  // Mistral
  'mistral-large-latest': { inputPerMTok: 2, outputPerMTok: 6 },
  'mistral-small-latest': { inputPerMTok: 0.2, outputPerMTok: 0.6 },

  // Mock - free for tests
  'mock-model': { inputPerMTok: 0, outputPerMTok: 0 },
};

function lookup(model: string): ModelRate {
  if (RATES[model]) return RATES[model];
  // Try lower-cased
  const k = model.toLowerCase();
  if (RATES[k]) return RATES[k];
  // Try matching prefix (e.g. "claude-3-5-sonnet-20241022" matches "claude-3-5-sonnet-latest")
  for (const known of Object.keys(RATES)) {
    if (model.startsWith(known) || known.startsWith(model)) return RATES[known];
  }
  return DEFAULT_FALLBACK;
}

/**
 * Estimate USD cost for a single LLM call.
 * Returns 0 for mock provider regardless of token counts.
 */
export function estimateCost(args: {
  providerType: string;
  model: string;
  tokenInput: number;
  tokenOutput: number;
}): number {
  if (args.providerType === 'mock') return 0;
  const rate = lookup(args.model);
  const inputCost = (args.tokenInput / 1_000_000) * rate.inputPerMTok;
  const outputCost = (args.tokenOutput / 1_000_000) * rate.outputPerMTok;
  return Number((inputCost + outputCost).toFixed(6));
}
