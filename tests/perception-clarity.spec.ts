/**
 * Spec § 38.6 / § 16.2-16.12 - perception clarity formula.
 */
import { describe, it, expect } from 'vitest';
import {
  computeClarity,
  canInfer,
  familiarityScore,
} from '@/lib/perception/clarity';

describe('clarity - base by spatial relation', () => {
  it('same_table = 5 (with neutral modifiers)', () => {
    const c = computeClarity({
      spatialRelation: 'same_table_or_direct_interaction',
      perception: 50,
    });
    expect(c).toBe(5);
  });

  it('different_location with low perception = 0', () => {
    expect(
      computeClarity({
        spatialRelation: 'different_location',
        perception: 10,
        familiarity: 0,
      }),
    ).toBe(0);
  });

  it('different_location stays low even with high perception', () => {
    // base=0; perception+2; obstacles 0; etc → bounded but at least near floor
    const c = computeClarity({ spatialRelation: 'different_location', perception: 100 });
    expect(c).toBeLessThanOrEqual(2);
  });

  it('same_room_far = 2', () => {
    const c = computeClarity({ spatialRelation: 'same_room_far', perception: 50 });
    expect(c).toBe(2);
  });
});

describe('clarity - modifier composition', () => {
  it('high noise reduces clarity', () => {
    const quiet = computeClarity({ spatialRelation: 'same_zone_near', noise: 0, perception: 50 });
    const loud = computeClarity({ spatialRelation: 'same_zone_near', noise: 0.9, perception: 50 });
    expect(loud).toBeLessThan(quiet);
  });

  it('high obstacles reduces clarity', () => {
    const clear = computeClarity({
      spatialRelation: 'same_room_visible',
      obstacles: 0,
      perception: 50,
    });
    const blocked = computeClarity({
      spatialRelation: 'same_room_visible',
      obstacles: 0.9,
      perception: 50,
    });
    expect(blocked).toBeLessThan(clear);
  });

  it('high perception increases clarity', () => {
    const low = computeClarity({ spatialRelation: 'same_room_far', perception: 10 });
    const high = computeClarity({ spatialRelation: 'same_room_far', perception: 95 });
    expect(high).toBeGreaterThan(low);
  });

  it('clarity stays in [0, 5]', () => {
    const r1 = computeClarity({
      spatialRelation: 'different_location',
      perception: 100,
      familiarity: 100,
    });
    expect(r1).toBeGreaterThanOrEqual(0);
    expect(r1).toBeLessThanOrEqual(5);

    const r2 = computeClarity({
      spatialRelation: 'same_table_or_direct_interaction',
      noise: 0,
      perception: 100,
      familiarity: 100,
    });
    expect(r2).toBe(5);
  });
});

describe('clarity - stealth/hidden target', () => {
  it('hidden target reduces clarity', () => {
    const visible = computeClarity({
      spatialRelation: 'same_zone_near',
      perception: 80,
      targetVisibilityState: 'normal',
    });
    const hidden = computeClarity({
      spatialRelation: 'same_zone_near',
      perception: 80,
      targetVisibilityState: 'hidden',
    });
    expect(hidden).toBeLessThan(visible);
  });

  it('high stealth + hiding = extra penalty for observer', () => {
    const lowStealth = computeClarity({
      spatialRelation: 'same_zone_near',
      perception: 50,
      targetVisibilityState: 'hidden',
      targetStealth: 20,
      targetIsHiding: true,
    });
    const highStealth = computeClarity({
      spatialRelation: 'same_zone_near',
      perception: 50,
      targetVisibilityState: 'hidden',
      targetStealth: 90,
      targetIsHiding: true,
    });
    expect(highStealth).toBeLessThanOrEqual(lowStealth);
  });
});

describe('familiarityScore', () => {
  it('zero relationship = 0', () => {
    expect(familiarityScore({})).toBe(0);
  });
  it('uses absolute value of trust + hostility', () => {
    const negTrust = familiarityScore({ trust: -50 });
    const posTrust = familiarityScore({ trust: 50 });
    expect(negTrust).toBe(posTrust);
  });
  it('combines all dimensions / 6', () => {
    const score = familiarityScore({
      trust: 60,
      hostility: 0,
      curiosity: 60,
      dependence: 0,
      attraction: 0,
      fear: 0,
    });
    expect(score).toBeCloseTo(20, 1); // (60 + 0 + 60 + 0 + 0 + 0) / 6
  });
});

describe('canInfer', () => {
  it('low social_insight = none', () => {
    expect(canInfer(20)).toBe('none');
  });
  it('medium social_insight = low', () => {
    expect(canInfer(50)).toBe('low');
  });
  it('90+ social_insight = high', () => {
    expect(canInfer(95)).toBe('high');
  });
});
