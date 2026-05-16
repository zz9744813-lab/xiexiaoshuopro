/**
 * Spec § 38.4 - critical audit blocks round commit.
 *
 * This is a unit test for RoundAbortedError contract; the full DB-side
 * round transaction rollback test belongs in tests/e2e (requires DB).
 */
import { describe, it, expect } from 'vitest';
import { RoundAbortedError } from '@/lib/simulation/engine';

describe('RoundAbortedError', () => {
  it('carries reason + findings', () => {
    const err = new RoundAbortedError('critical_audit', [
      { severity: 'critical', description: 'leak' },
    ]);
    expect(err.reason).toBe('critical_audit');
    expect(err.findings).toHaveLength(1);
    expect(err.findings[0].severity).toBe('critical');
  });

  it('is instanceof Error', () => {
    const err = new RoundAbortedError('critical_audit', []);
    expect(err).toBeInstanceOf(Error);
  });

  it('message defaults to reason', () => {
    const err = new RoundAbortedError('critical_audit', []);
    expect(err.message).toContain('critical_audit');
  });
});
