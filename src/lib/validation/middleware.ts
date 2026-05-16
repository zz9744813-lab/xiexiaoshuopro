/**
 * Validation middleware: wraps zod schema parsing + JSONB size/depth checks
 * with structured error responses per spec § 8.2.13.
 *
 * Usage:
 *   const handler = withValidation(mySchema, async (input, req) => { ... })
 *   export const POST = handler
 *
 * Errors return HTTP 400 with:
 *   { ok: false, error: { code, message, field?, constraint? } }
 */
import { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';
import { jsonbSize, jsonDepth } from './schemas';

export interface ValidationError {
  code:
    | 'INVALID_BODY'
    | 'JSONB_SIZE_EXCEEDED'
    | 'JSONB_DEPTH_EXCEEDED'
    | 'EMBEDDING_DIMENSION_MISMATCH'
    | 'RELATIONSHIP_DELTA_OUT_OF_RANGE'
    | 'CUSTOM';
  message: string;
  field?: string;
  constraint?: string;
}

export function failValidation(error: ValidationError, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error }, { status });
}

/**
 * Build a handler that parses + validates body via zod, plus optional
 * post-checks (JSONB size, embedding dim, etc).
 */
export function withValidation<TInput>(
  schema: z.ZodType<TInput>,
  handler: (input: TInput, req: NextRequest) => Promise<NextResponse> | NextResponse,
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return failValidation({ code: 'INVALID_BODY', message: 'Body is not valid JSON' });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return failValidation({
        code: 'INVALID_BODY',
        message: issue?.message ?? 'Validation failed',
        field: issue?.path.join('.'),
        constraint: issue?.code,
      });
    }

    return handler(parsed.data, req);
  };
}

/** Field-level JSONB size guard. Returns null on pass, error on fail. */
export function checkJsonbSize(args: {
  field: string;
  value: unknown;
  maxBytes: number;
}): ValidationError | null {
  if (jsonbSize(args.value) > args.maxBytes) {
    return {
      code: 'JSONB_SIZE_EXCEEDED',
      message: `Field ${args.field} exceeds ${args.maxBytes} bytes`,
      field: args.field,
      constraint: `jsonb_size <= ${args.maxBytes}`,
    };
  }
  return null;
}

/** Field-level JSONB depth guard. */
export function checkJsonbDepth(args: {
  field: string;
  value: unknown;
  maxDepth: number;
}): ValidationError | null {
  if (jsonDepth(args.value) > args.maxDepth) {
    return {
      code: 'JSONB_DEPTH_EXCEEDED',
      message: `Field ${args.field} JSONB nesting > ${args.maxDepth}`,
      field: args.field,
      constraint: `jsonb_depth <= ${args.maxDepth}`,
    };
  }
  return null;
}

/** Embedding dimension must match world's embedding profile. */
export async function checkEmbeddingDimension(args: {
  embedding: number[];
  expectedDimension: number;
}): Promise<ValidationError | null> {
  if (args.embedding.length !== args.expectedDimension) {
    return {
      code: 'EMBEDDING_DIMENSION_MISMATCH',
      message: `Embedding has ${args.embedding.length} dimensions, expected ${args.expectedDimension}`,
      field: 'embedding',
      constraint: `length === ${args.expectedDimension}`,
    };
  }
  return null;
}

/** Per spec § 27.2 - single-round relationship delta hard caps. */
export function checkRelationshipDelta(args: {
  field: string;
  delta: number;
  eventLevel: 'ordinary' | 'meaningful' | 'major' | 'extreme';
}): ValidationError | null {
  const bounds: Record<string, number> = {
    ordinary: 5,
    meaningful: 10,
    major: 15,
    extreme: 40,
  };
  const cap = bounds[args.eventLevel];
  if (Math.abs(args.delta) > cap) {
    return {
      code: 'RELATIONSHIP_DELTA_OUT_OF_RANGE',
      message: `relationship_delta ${args.delta} exceeds cap ${cap} for event_level=${args.eventLevel}`,
      field: args.field,
      constraint: `|delta| <= ${cap}`,
    };
  }
  return null;
}
