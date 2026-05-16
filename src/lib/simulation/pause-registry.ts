/**
 * In-process pause/abort registry for in-flight LLM rounds.
 * Per spec § 21.6 / B-3.
 *
 * Each running round registers an AbortController. The pause/abort API
 * routes look up the controller by roundId and call .abort() on it. The
 * engine awaits character calls with the signal injected; aborted calls
 * settle as 'interrupted' and traces are persisted.
 *
 * For multi-process deployments, replace the in-memory map with Redis
 * pub/sub; the controller is per-worker so the API gateway needs to know
 * which worker holds the round (out of MVP scope).
 */

declare global {
  // eslint-disable-next-line no-var
  var __sim_pause_registry__: Map<string, AbortController> | undefined;
}

const registry: Map<string, AbortController> =
  globalThis.__sim_pause_registry__ ?? new Map();
if (!globalThis.__sim_pause_registry__) globalThis.__sim_pause_registry__ = registry;

export function registerRound(roundId: string): AbortController {
  const ac = new AbortController();
  registry.set(roundId, ac);
  return ac;
}

export function unregisterRound(roundId: string): void {
  registry.delete(roundId);
}

export function pauseRound(roundId: string): boolean {
  const ac = registry.get(roundId);
  if (!ac) return false;
  ac.abort();
  return true;
}

export function isRoundActive(roundId: string): boolean {
  return registry.has(roundId);
}

export function activeRoundIds(): string[] {
  return Array.from(registry.keys());
}
