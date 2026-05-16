/**
 * Mock adapter for seed data and offline demos / tests.
 *
 * Returns canned valid JSON outputs based on the system prompt's role.
 * Detection heuristic:
 *   - if messages[0].content references "世界裁判" / world_agent → return WorldAgentRoundResult
 *   - if messages[0].content references "小说整理器" / narrator → return NovelizerChapterOutput
 *   - else → return CharacterActionOutput
 *
 * The metadata.mock_response_seed lets you override fixed outputs per profile.
 */
import type { LLMAdapter, LLMRequest, LLMResponse, ModelInfo, ProviderCredentials } from './types';

type Role = 'character' | 'world_agent' | 'narrator';

function detectRole(req: LLMRequest): Role {
  const sys = req.messages.find((m) => m.role === 'system')?.content ?? '';
  if (/世界裁判|world.?agent|world_agent_system/i.test(sys)) return 'world_agent';
  if (/小说整理器|narrator|novelizer/i.test(sys)) return 'narrator';
  return 'character';
}

function characterCanned(): Record<string, unknown> {
  // Deterministic minimal valid output (passes JSON Schema in spec App C.1)
  return {
    action_type: 'speak_and_act',
    public_layer: {
      spoken_text: '你问错人了。',
      visible_action: '她端起酒杯，避开了对方的视线。',
      tone: '轻描淡写',
      observable_clues: ['她转移话题的速度很快。'],
    },
    private_layer: {
      thought: '不能让他知道昨晚的事。',
      intention: '避开钟楼话题。',
      emotion: { surface: '平静', true: '紧张' },
      risk_assessment: '当前暴露风险中等。',
    },
    memory_update: {
      private: ['他开始追问钟楼。'],
      public: [],
    },
    desired_next_action: '把话题转到王室封锁北区。',
  };
}

function worldAgentCanned(req: LLMRequest): Record<string, unknown> {
  // Try to reference incoming action ids (best-effort) so events can carry source_action_ids
  const userMsg = req.messages.find((m) => m.role === 'user')?.content ?? '';
  const ids = Array.from(userMsg.matchAll(/"action_id"\s*:\s*"([0-9a-f-]{8,})"/g)).map(
    (m) => m[1],
  );
  return {
    round_result: {
      public_events: [
        {
          summary: '两人在桌边交谈，她回避了关键问题。',
          involved_action_ids: ids.slice(0, 4),
          event_level: 'ordinary',
          importance: 0.4,
        },
      ],
      private_events: [],
      world_state_delta: {},
      entity_state_deltas: [],
      relationship_deltas: [],
      memory_write_requests: [],
      observable_clues: [],
      conflict_resolutions: [],
      next_scene_suggestions: [],
    },
  };
}

function narratorCanned(): Record<string, unknown> {
  return {
    chapter_title: '地下酒馆',
    chapter_markdown:
      '酒馆的灯光昏黄，他将杯子推到她面前。\n\n她笑了一下，没有接话。',
    source_event_ids: [],
    memory_write_requests: [],
    faithfulness_report: {
      score: 0.95,
      added_literary_details: ['昏黄灯光'],
      changed_major_facts: false,
      new_major_events: [],
    },
  };
}

function estimateTokens(s: string): number {
  if (!s) return 0;
  const cjk = s.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  return Math.ceil(cjk * 1.5 + (s.length - cjk) / 4);
}

export class MockAdapter implements LLMAdapter {
  readonly providerType = 'mock';

  constructor(private readonly creds: ProviderCredentials) {}

  async generate(input: LLMRequest): Promise<LLMResponse> {
    const role = detectRole(input);
    // Optional override via provider metadata.mock_response_seed
    const seed = (this.creds.metadata?.mock_response_seed as Record<string, unknown> | undefined) ?? {};
    const canned =
      (seed[role] as Record<string, unknown> | undefined) ??
      (role === 'world_agent'
        ? worldAgentCanned(input)
        : role === 'narrator'
          ? narratorCanned()
          : characterCanned());

    const text = JSON.stringify(canned);
    const inputText = input.messages.map((m) => m.content).join('\n');
    return {
      rawText: text,
      parsedJson: canned,
      tokenInput: estimateTokens(inputText),
      tokenOutput: estimateTokens(text),
      latencyMs: 5,
      modelReported: input.model || 'mock-model',
    };
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  async listModels(): Promise<ModelInfo[]> {
    return [{ id: 'mock-model', name: 'Mock model (offline canned outputs)' }];
  }
}
