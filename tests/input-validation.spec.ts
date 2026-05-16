/**
 * Spec § 38.17 / Appendix A - input validation primitives.
 */
import { describe, it, expect } from 'vitest';
import {
  jsonbSize,
  jsonDepth,
  STR,
  abilityValueSchema,
  worldTimeSchema,
  speechStyleSchema,
} from '@/lib/validation/schemas';
import { checkJsonbSize, checkJsonbDepth, checkEmbeddingDimension } from '@/lib/validation/middleware';

describe('jsonbSize', () => {
  it('counts UTF-8 bytes', () => {
    expect(jsonbSize({ k: 'hello' })).toBe(13);
    // CJK 3 bytes each
    const obj = { k: '世界' };
    expect(jsonbSize(obj)).toBeGreaterThan(11);
  });
});

describe('jsonDepth', () => {
  it('flat object = depth 1', () => {
    expect(jsonDepth({ a: 1 })).toBe(1);
  });
  it('nested 3 deep', () => {
    expect(jsonDepth({ a: { b: { c: 1 } } })).toBe(3);
  });
  it('arrays count', () => {
    expect(jsonDepth([[[1]]])).toBe(3);
  });
  it('null is depth 0', () => {
    expect(jsonDepth(null)).toBe(0);
  });
});

describe('checkJsonbSize / checkJsonbDepth', () => {
  it('passes when under limit', () => {
    expect(checkJsonbSize({ field: 'x', value: { a: 1 }, maxBytes: 1024 })).toBeNull();
  });
  it('fails with structured error', () => {
    const big = { x: 'a'.repeat(10000) };
    const err = checkJsonbSize({ field: 'x', value: big, maxBytes: 1024 });
    expect(err).not.toBeNull();
    expect(err?.code).toBe('JSONB_SIZE_EXCEEDED');
    expect(err?.field).toBe('x');
  });
  it('depth fail at 7', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: 1 } } } } } } };
    const err = checkJsonbDepth({ field: 'x', value: deep, maxDepth: 6 });
    expect(err?.code).toBe('JSONB_DEPTH_EXCEEDED');
  });
});

describe('checkEmbeddingDimension', () => {
  it('passes when dim matches', async () => {
    const r = await checkEmbeddingDimension({
      embedding: new Array(1536).fill(0),
      expectedDimension: 1536,
    });
    expect(r).toBeNull();
  });
  it('fails when mismatch', async () => {
    const r = await checkEmbeddingDimension({
      embedding: new Array(512).fill(0),
      expectedDimension: 1536,
    });
    expect(r?.code).toBe('EMBEDDING_DIMENSION_MISMATCH');
    expect(r?.message).toContain('512');
    expect(r?.message).toContain('1536');
  });
});

describe('Appendix A enforcement via zod', () => {
  it('entity name max 80', () => {
    expect(STR.entityName.safeParse('a'.repeat(80)).success).toBe(true);
    expect(STR.entityName.safeParse('a'.repeat(81)).success).toBe(false);
  });
  it('ability values 0-100 integer', () => {
    expect(abilityValueSchema.safeParse(0).success).toBe(true);
    expect(abilityValueSchema.safeParse(100).success).toBe(true);
    expect(abilityValueSchema.safeParse(101).success).toBe(false);
    expect(abilityValueSchema.safeParse(-1).success).toBe(false);
    expect(abilityValueSchema.safeParse(50.5).success).toBe(false);
  });
  it('world_time.world_day must be >= 0', () => {
    expect(worldTimeSchema.safeParse({ world_day: 0 }).success).toBe(true);
    expect(worldTimeSchema.safeParse({ world_day: -1 }).success).toBe(false);
  });
  it('speech_style.sample_lines max 20', () => {
    expect(
      speechStyleSchema.safeParse({ sample_lines: new Array(20).fill('x') }).success,
    ).toBe(true);
    expect(
      speechStyleSchema.safeParse({ sample_lines: new Array(21).fill('x') }).success,
    ).toBe(false);
  });
});
