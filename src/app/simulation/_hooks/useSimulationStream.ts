'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Round, Action, SimulationRun, SimEvent } from '../_lib/types';

interface UseStreamArgs {
  worldId: string;
  sceneId: string;
}

/**
 * SSE-driven simulation stream hook.
 * Replaces the old setInterval(2000ms) polling — all updates come from SSE
 * with smart incremental re-fetch on key events:
 *   - round.started / character.call.completed / world.call.completed → reload actions
 *   - round.committed → reload rounds + actions + run + costs
 *   - run.* → reload run
 */
export function useSimulationStream({ worldId, sceneId }: UseStreamArgs) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [activeRun, setActiveRun] = useState<SimulationRun | null>(null);
  const [events, setEvents] = useState<SimEvent[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSceneData = useCallback(async () => {
    if (!sceneId) {
      setRounds([]); setActions([]); setActiveRun(null);
      return;
    }
    const [rd, run] = await Promise.all([
      fetch(`/api/scenes/${sceneId}/rounds`).then((x) => x.json()),
      fetch(`/api/simulation/runs?sceneId=${sceneId}`).then((x) => x.json()),
    ]);
    if (rd.ok) {
      setRounds(rd.data.rounds);
      setActions(rd.data.actions);
    }
    if (run.ok) {
      const runs = run.data as SimulationRun[];
      const live = runs.find((x: SimulationRun) =>
        ['starting', 'running', 'paused', 'stopping'].includes(x.status),
      );
      setActiveRun(live ?? runs[0] ?? null);
    }
  }, [sceneId]);

  // Debounced refresh — coalesce bursty events
  const scheduleRefresh = useCallback((delay = 250) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void loadSceneData(); }, delay);
  }, [loadSceneData]);

  // initial + scene change
  useEffect(() => { void loadSceneData(); }, [loadSceneData]);

  // SSE
  useEffect(() => {
    if (!worldId) return;
    const es = new EventSource(`/api/events/stream?world_id=${worldId}`);
    esRef.current = es;

    const pushEvent = (raw: string) => {
      try {
        const ev = JSON.parse(raw) as SimEvent;
        setEvents((prev) => [ev, ...prev].slice(0, 200));
        return ev;
      } catch { return null; }
    };

    es.onmessage = (msg) => {
      const ev = pushEvent(msg.data);
      if (!ev) return;
      // generic — refresh on most events
      scheduleRefresh();
    };

    const refreshTypes = [
      'round.started',
      'round.committed',
      'round.rolled_back',
      'character.call.completed',
      'world.call.completed',
      'cost.budget.warning',
      'cost.budget.exceeded',
      'run.started',
      'run.paused',
      'run.resumed',
      'run.stopped',
      'run.failed',
    ];
    const handler = (e: MessageEvent) => {
      const ev = pushEvent(e.data);
      if (!ev) return;
      scheduleRefresh();
    };
    refreshTypes.forEach((t) => es.addEventListener(t, handler as EventListener));

    return () => { es.close(); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [worldId, scheduleRefresh]);

  return { rounds, actions, activeRun, events, refresh: loadSceneData };
}
