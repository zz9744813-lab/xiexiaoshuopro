/**
 * JSON Schemas for LLM outputs per spec Appendix C.
 * These are validated with ajv after each LLM call.
 */

export const characterActionSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'CharacterActionOutput',
  type: 'object',
  required: ['action_type', 'public_layer', 'private_layer', 'memory_update'],
  additionalProperties: false,
  properties: {
    action_type: {
      type: 'string',
      enum: [
        'speak_only', 'act_only', 'speak_and_act', 'observe', 'move',
        'wait', 'hide', 'attack', 'use_item', 'thinking_only',
      ],
    },
    public_layer: {
      type: 'object',
      additionalProperties: false,
      properties: {
        spoken_text: { type: 'string', maxLength: 2000 },
        visible_action: { type: 'string', maxLength: 1000 },
        tone: { type: 'string', maxLength: 200 },
        facial_expression: { type: 'string', maxLength: 200 },
        observable_clues: {
          type: 'array',
          maxItems: 8,
          items: { type: 'string', maxLength: 300 },
        },
      },
    },
    private_layer: {
      type: 'object',
      additionalProperties: false,
      properties: {
        thought: { type: 'string', maxLength: 2000 },
        intention: { type: 'string', maxLength: 500 },
        emotion: {
          type: 'object',
          additionalProperties: false,
          properties: {
            surface: { type: 'string', maxLength: 100 },
            true: { type: 'string', maxLength: 200 },
          },
        },
        risk_assessment: { type: 'string', maxLength: 500 },
        fear: { type: 'string', maxLength: 200 },
      },
    },
    memory_update: {
      type: 'object',
      additionalProperties: false,
      properties: {
        private: { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 500 } },
        public: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 500 } },
      },
    },
    desired_next_action: { type: 'string', maxLength: 500 },
  },
} as const;

export const worldAgentResultSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'WorldAgentRoundResult',
  type: 'object',
  required: ['round_result'],
  additionalProperties: false,
  properties: {
    round_result: {
      type: 'object',
      required: ['public_events', 'world_state_delta', 'memory_write_requests'],
      additionalProperties: false,
      properties: {
        public_events: {
          type: 'array',
          items: {
            type: 'object',
            required: ['summary', 'involved_action_ids'],
            properties: {
              summary: { type: 'string', maxLength: 2000 },
              involved_action_ids: {
                type: 'array',
                items: { type: 'string', format: 'uuid' },
              },
              event_level: {
                type: 'string',
                enum: ['ordinary', 'meaningful', 'major', 'extreme'],
              },
              importance: { type: 'number', minimum: 0, maximum: 1 },
            },
          },
        },
        private_events: { type: 'array' },
        world_state_delta: { type: 'object' },
        entity_state_deltas: { type: 'array' },
        relationship_deltas: { type: 'array' },
        memory_write_requests: {
          type: 'array',
          items: {
            type: 'object',
            required: [
              'owner_entity_id', 'memory_type', 'visibility', 'content', 'proposed_by',
            ],
            properties: {
              owner_entity_id: { type: 'string', format: 'uuid' },
              memory_type: { type: 'string' },
              visibility: { type: 'string' },
              content: { type: 'string', maxLength: 4000 },
              importance: { type: 'number', minimum: 0, maximum: 1 },
              emotional_weight: { type: 'number', minimum: 0, maximum: 1 },
              proposed_by: {
                type: 'string',
                enum: [
                  'world_resolved', 'character_self', 'director',
                  'novelizer', 'user_manual', 'system_note',
                ],
              },
            },
          },
        },
        observable_clues: { type: 'array' },
        conflict_resolutions: { type: 'array' },
        next_scene_suggestions: { type: 'array' },
      },
    },
  },
} as const;

export const novelizerChapterSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'NovelizerChapterOutput',
  type: 'object',
  required: ['chapter_title', 'chapter_markdown', 'source_event_ids', 'faithfulness_report'],
  additionalProperties: false,
  properties: {
    chapter_title: { type: 'string', maxLength: 200 },
    chapter_markdown: { type: 'string', maxLength: 100000 },
    source_event_ids: {
      type: 'array',
      items: { type: 'string', format: 'uuid' },
    },
    memory_write_requests: { type: 'array' },
    faithfulness_report: {
      type: 'object',
      required: ['score'],
      additionalProperties: false,
      properties: {
        score: { type: 'number', minimum: 0, maximum: 1 },
        added_literary_details: {
          type: 'array',
          items: { type: 'string', maxLength: 200 },
        },
        changed_major_facts: { type: 'boolean' },
        new_major_events: {
          type: 'array',
          items: { type: 'string', maxLength: 500 },
        },
        notes: { type: 'string', maxLength: 2000 },
      },
    },
  },
} as const;
