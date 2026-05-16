/**
 * Spec § 38.5 / § 27.2 - single-round relationship delta hard caps.
 */
import { describe, it, expect } from 'vitest';
import { checkRelationshipDelta } from '@/lib/validation/middleware';

describe('checkRelationshipDelta - per spec § 27.2', () => {
  const cases: Array<{
    level: 'ordinary' | 'meaningful' | 'major' | 'extreme';
    cap: number;
  }> = [
    { level: 'ordinary', cap: 5 },
    { level: 'meaningful', cap: 10 },
    { level: 'major', cap: 15 },
    { level: 'extreme', cap: 40 },
  ];

  for (const { level, cap } of cases) {
    it(`level=${level} accepts |delta|<=${cap}`, () => {
      expect(checkRelationshipDelta({ field: 'trust', delta: cap, eventLevel: level })).toBeNull();
      expect(checkRelationshipDelta({ field: 'trust', delta: -cap, eventLevel: level })).toBeNull();
      expect(checkRelationshipDelta({ field: 'trust', delta: 0, eventLevel: level })).toBeNull();
    });

    it(`level=${level} rejects |delta|>${cap}`, () => {
      const over = checkRelationshipDelta({
        field: 'trust',
        delta: cap + 1,
        eventLevel: level,
      });
      expect(over).not.toBeNull();
      expect(over?.code).toBe('RELATIONSHIP_DELTA_OUT_OF_RANGE');

      const underNeg = checkRelationshipDelta({
        field: 'trust',
        delta: -(cap + 1),
        eventLevel: level,
      });
      expect(underNeg).not.toBeNull();
    });
  }

  it('huge swing rejected even with extreme', () => {
    const r = checkRelationshipDelta({ field: 'trust', delta: 200, eventLevel: 'extreme' });
    expect(r).not.toBeNull();
  });
});
