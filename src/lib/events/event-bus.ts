/**
 * Simple in-process event bus for SSE broadcasting.
 * For multi-instance deployments, replace with Redis pub/sub.
 */

export type SimEventType =
  | 'simulation.started'
  | 'scene.started'
  | 'round.started'
  | 'phase.started'
  | 'context.generated'
  | 'character.call.started'
  | 'character.call.completed'
  | 'character.call.failed'
  | 'world.call.started'
  | 'world.call.completed'
  | 'audit.completed'
  | 'round.committed'
  | 'round.rolled_back'
  | 'scene.completed'
  | 'novel.generated'
  | 'simulation.paused'
  | 'simulation.resumed'
  | 'cost.budget.warning'
  | 'cost.budget.exceeded'
  | 'memory_write_request.created'
  | 'memory_write_request.approved'
  | 'drift.warning'
  | 'stagnation.detected'
  | 'heartbeat';

export interface SimEvent {
  id: string;
  type: SimEventType;
  worldId?: string;
  worldlineId?: string;
  sceneId?: string;
  roundId?: string;
  entityId?: string;
  phase?: string;
  data?: unknown;
  ts: number;
}

type Listener = (ev: SimEvent) => void;

class EventBus {
  private listeners = new Map<string, Set<Listener>>();
  private buffer: SimEvent[] = [];
  private bufferLimit = 1000;

  subscribe(channel: string, fn: Listener): () => void {
    let s = this.listeners.get(channel);
    if (!s) {
      s = new Set();
      this.listeners.set(channel, s);
    }
    s.add(fn);
    return () => {
      this.listeners.get(channel)?.delete(fn);
    };
  }

  publish(channel: string, ev: SimEvent): void {
    this.buffer.push(ev);
    if (this.buffer.length > this.bufferLimit) this.buffer.shift();
    this.listeners.get(channel)?.forEach((fn) => {
      try {
        fn(ev);
      } catch {
        // ignore listener errors
      }
    });
    // Also publish to global '*' channel
    this.listeners.get('*')?.forEach((fn) => {
      try {
        fn(ev);
      } catch {
        // ignore
      }
    });
  }

  /** Recent buffered events (for SSE last-event-id reconnect) */
  recent(sinceId?: string, max = 200): SimEvent[] {
    if (!sinceId) return this.buffer.slice(-max);
    const idx = this.buffer.findIndex((e) => e.id === sinceId);
    if (idx === -1) return this.buffer.slice(-max);
    return this.buffer.slice(idx + 1).slice(-max);
  }
}

// Module-level singleton (next dev can hot-reload; use globalThis to persist)
declare global {
  // eslint-disable-next-line no-var
  var __sim_event_bus__: EventBus | undefined;
}

export const eventBus = globalThis.__sim_event_bus__ ?? new EventBus();
if (!globalThis.__sim_event_bus__) globalThis.__sim_event_bus__ = eventBus;

export function publishEvent(
  type: SimEventType,
  data: Partial<SimEvent> & { worldId: string },
): void {
  const ev: SimEvent = {
    id: crypto.randomUUID(),
    type,
    ts: Date.now(),
    ...data,
  };
  eventBus.publish(data.worldId, ev);
}
