'use client';

import { useEffect, useRef, useState } from 'react';

interface World {
  id: string;
  name: string;
  defaultWorldlineId?: string | null;
}

interface Entity {
  id: string;
  name: string;
  entityType: string;
}

interface Scene {
  id: string;
  title?: string | null;
  status: string;
  participantEntityIds: string[];
  createdAt: string;
}

interface Action {
  id: string;
  entityId: string;
  publicLayer: Record<string, unknown>;
  privateLayer: Record<string, unknown>;
  isFallback: boolean;
}

interface Round {
  id: string;
  roundIndex: number;
  status: string;
  mode: string;
}

interface SimEvent {
  id: string;
  type: string;
  ts: number;
  data?: unknown;
}

export default function SimulationPage() {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [worldId, setWorldId] = useState('');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState('');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [costs, setCosts] = useState<{ today?: { cost: number } }>({});
  const [busy, setBusy] = useState(false);
  const [perspective, setPerspective] = useState<'author' | string>('author'); // entityId or 'author'
  const [participantsForm, setParticipantsForm] = useState<string[]>([]);
  const [sceneTitle, setSceneTitle] = useState('');
  const [runMode, setRunMode] = useState<'simultaneous' | 'hybrid_two_phase'>('simultaneous');
  const esRef = useRef<EventSource | null>(null);

  async function loadWorlds() {
    const r = await fetch('/api/worlds').then((x) => x.json());
    if (r.ok) {
      setWorlds(r.data);
      if (r.data.length && !worldId) setWorldId(r.data[0].id);
    }
  }

  async function loadWorldData() {
    if (!worldId) return;
    const [e, s, c] = await Promise.all([
      fetch(`/api/entities?world_id=${worldId}`).then((x) => x.json()),
      fetch(`/api/scenes/list?world_id=${worldId}`).then((x) => x.json()),
      fetch(`/api/cost/summary?world_id=${worldId}`).then((x) => x.json()),
    ]);
    if (e.ok) setEntities(e.data);
    if (s.ok) setScenes(s.data);
    if (c.ok) setCosts(c.data);
  }

  async function loadSceneRounds() {
    if (!activeSceneId) return;
    const r = await fetch(`/api/scenes/${activeSceneId}/rounds`).then((x) => x.json());
    if (r.ok) {
      setRounds(r.data.rounds);
      setActions(r.data.actions);
    }
  }

  useEffect(() => {
    void loadWorlds();
  }, []);
  useEffect(() => {
    void loadWorldData();
  }, [worldId]);
  useEffect(() => {
    void loadSceneRounds();
  }, [activeSceneId]);

  // SSE subscription
  useEffect(() => {
    if (!worldId) return;
    const es = new EventSource(`/api/events/stream?world_id=${worldId}`);
    esRef.current = es;
    es.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data);
        setEvents((prev) => [ev, ...prev].slice(0, 100));
        if (ev.type === 'round.committed' || ev.type === 'round.rolled_back') {
          void loadSceneRounds();
          void loadWorldData(); // refresh costs
        }
      } catch {
        // ignore
      }
    };
    // Generic event listener
    const handler = (e: MessageEvent) => {
      try {
        const ev = JSON.parse(e.data);
        setEvents((prev) => [ev, ...prev].slice(0, 100));
      } catch {
        // ignore
      }
    };
    [
      'round.started',
      'round.committed',
      'round.rolled_back',
      'character.call.completed',
      'world.call.completed',
      'cost.budget.warning',
      'cost.budget.exceeded',
    ].forEach((t) => es.addEventListener(t, handler as EventListener));

    return () => {
      es.close();
    };
  }, [worldId]);

  async function createScene(e: React.FormEvent) {
    e.preventDefault();
    const world = worlds.find((w) => w.id === worldId);
    if (!world?.defaultWorldlineId) {
      alert('世界没有 default_worldline');
      return;
    }
    const res = await fetch('/api/scenes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worldId,
        worldlineId: world.defaultWorldlineId,
        title: sceneTitle || undefined,
        participantEntityIds: participantsForm,
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setSceneTitle('');
      setParticipantsForm([]);
      await loadWorldData();
      setActiveSceneId(json.data.id);
    } else {
      alert(json.error?.message ?? '创建失败');
    }
  }

  async function runRound() {
    if (!activeSceneId) return;
    setBusy(true);
    try {
      const res = await fetch('/api/simulation/run-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneId: activeSceneId, mode: runMode }),
      });
      const json = await res.json();
      if (!json.ok) alert(json.error?.message ?? '执行失败');
    } finally {
      setBusy(false);
      void loadSceneRounds();
    }
  }

  async function forkBranch() {
    const world = worlds.find((w) => w.id === worldId);
    if (!world?.defaultWorldlineId) return;
    const name = prompt('分支名称：');
    if (!name) return;
    const reason = prompt('分支理由（可选）：') ?? '';
    const res = await fetch('/api/worldlines/fork', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worldId,
        parentWorldlineId: world.defaultWorldlineId,
        name,
        branchReason: reason,
        sceneId: activeSceneId || undefined,
      }),
    });
    const json = await res.json();
    if (json.ok) {
      alert(
        `已 fork：复制 ${json.data.copiedMemories} 条记忆，${json.data.copiedRelationships} 条关系`,
      );
    } else {
      alert(json.error?.message ?? 'fork 失败');
    }
  }

  async function injectEvent() {
    const world = worlds.find((w) => w.id === worldId);
    if (!world?.defaultWorldlineId) return;
    const summary = prompt('事件摘要（如：王都北区突然戒严）：');
    if (!summary) return;
    const res = await fetch('/api/directives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worldId,
        worldlineId: world.defaultWorldlineId,
        directiveType: 'inject_event',
        mode: 'soft',
        content: { summary, scene_id: activeSceneId || undefined },
      }),
    });
    const json = await res.json();
    if (json.ok) {
      alert('事件已注入，下一轮主世界会读到它');
      void loadSceneRounds();
    } else {
      alert(json.error?.message ?? '失败');
    }
  }

  const characterEntities = entities.filter((e) => e.entityType === 'character');
  const activeScene = scenes.find((s) => s.id === activeSceneId);

  return (
    <main className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold">模拟控制台</h1>
          <select
            value={worldId}
            onChange={(e) => setWorldId(e.target.value)}
            className="px-3 py-1 border rounded bg-white dark:bg-zinc-900"
          >
            {worlds.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <span className="ml-auto text-sm text-zinc-500">
            今日成本：${(costs.today?.cost ?? 0).toFixed(4)}
          </span>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Left: scene list + create */}
          <aside className="col-span-3 space-y-4">
            <form
              onSubmit={createScene}
              className="p-4 bg-white dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 space-y-2"
            >
              <h3 className="font-semibold text-sm">新建场景</h3>
              <input
                type="text"
                placeholder="场景标题"
                value={sceneTitle}
                onChange={(e) => setSceneTitle(e.target.value)}
                maxLength={200}
                className="w-full px-2 py-1 border rounded bg-white dark:bg-zinc-900 text-sm"
              />
              <div className="text-xs text-zinc-500 mb-1">参与角色：</div>
              <div className="space-y-1 max-h-48 overflow-auto">
                {characterEntities.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={participantsForm.includes(e.id)}
                      onChange={(ev) => {
                        if (ev.target.checked)
                          setParticipantsForm([...participantsForm, e.id]);
                        else
                          setParticipantsForm(
                            participantsForm.filter((x) => x !== e.id),
                          );
                      }}
                    />
                    {e.name}
                  </label>
                ))}
              </div>
              <button
                type="submit"
                disabled={participantsForm.length === 0}
                className="w-full px-3 py-1 text-sm bg-zinc-900 text-white rounded disabled:opacity-50"
              >
                创建场景
              </button>
            </form>

            <div className="p-4 bg-white dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800">
              <h3 className="font-semibold text-sm mb-2">已有场景</h3>
              {scenes.length === 0 ? (
                <p className="text-xs text-zinc-500">暂无</p>
              ) : (
                <ul className="space-y-1">
                  {scenes.map((s) => (
                    <li
                      key={s.id}
                      className={`p-2 text-sm rounded cursor-pointer ${
                        activeSceneId === s.id
                          ? 'bg-zinc-900 text-white'
                          : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'
                      }`}
                      onClick={() => setActiveSceneId(s.id)}
                    >
                      <div>{s.title || '(无标题)'}</div>
                      <div className="text-xs opacity-70">{s.status}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          {/* Center: theatre */}
          <section className="col-span-6 space-y-4">
            <div className="p-4 bg-white dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold">
                    {activeScene?.title || '请选择场景'}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {activeSceneId &&
                      `${rounds.length} 轮 · ${actions.length} 个 action`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={perspective}
                    onChange={(e) => setPerspective(e.target.value)}
                    className="px-2 py-1 text-sm border rounded bg-white dark:bg-zinc-900"
                  >
                    <option value="author">上帝视角</option>
                    {characterEntities.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} 视角
                      </option>
                    ))}
                  </select>
                  <select
                    value={runMode}
                    onChange={(e) =>
                      setRunMode(e.target.value as 'simultaneous' | 'hybrid_two_phase')
                    }
                    className="px-2 py-1 text-sm border rounded bg-white dark:bg-zinc-900"
                  >
                    <option value="simultaneous">同步并行</option>
                    <option value="hybrid_two_phase">混合两段式</option>
                  </select>
                  <button
                    onClick={injectEvent}
                    disabled={!activeSceneId}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                    title="导演投放事件"
                  >
                    投放事件
                  </button>
                  <button
                    onClick={forkBranch}
                    disabled={!worldId}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                    title="从当前 worldline 创建分支"
                  >
                    Fork
                  </button>
                  <button
                    onClick={runRound}
                    disabled={!activeSceneId || busy}
                    className="px-3 py-1 text-sm bg-zinc-900 text-white rounded disabled:opacity-50"
                  >
                    {busy ? '运行中...' : '运行下一轮'}
                  </button>
                </div>
              </div>

              <div className="space-y-3 max-h-[60vh] overflow-auto">
                {rounds.length === 0 && (
                  <p className="text-sm text-zinc-500">暂无 round</p>
                )}
                {rounds.map((r) => {
                  const roundActions = actions.filter((a) => {
                    // We only have a flat list; ideally action.roundId, but our shape lacks it. Use all for MVP.
                    void r;
                    return true;
                  });
                  return (
                    <div
                      key={r.id}
                      className="border-l-2 border-zinc-300 dark:border-zinc-700 pl-3"
                    >
                      <div className="text-xs text-zinc-500 mb-2">
                        Round #{r.roundIndex} · {r.mode} · {r.status}
                      </div>
                      <div className="space-y-2">
                        {roundActions.map((a) => {
                          const entity = entities.find((e) => e.id === a.entityId);
                          const pl = a.publicLayer as Record<string, string>;
                          const prl = a.privateLayer as Record<string, unknown>;
                          const showPrivate =
                            perspective === 'author' || perspective === a.entityId;
                          return (
                            <div
                              key={a.id}
                              className="text-sm p-2 bg-zinc-50 dark:bg-zinc-900 rounded"
                            >
                              <div className="flex justify-between">
                                <span className="font-medium">
                                  {entity?.name ?? a.entityId.slice(0, 8)}
                                </span>
                                {a.isFallback && (
                                  <span className="text-xs text-yellow-600">
                                    (fallback)
                                  </span>
                                )}
                              </div>
                              {pl.spoken_text && (
                                <p className="mt-1">『{pl.spoken_text}』</p>
                              )}
                              {pl.visible_action && (
                                <p className="text-zinc-600 italic">
                                  {pl.visible_action}
                                </p>
                              )}
                              {showPrivate && Boolean(prl.thought) && (
                                <p className="mt-1 text-xs text-purple-600 dark:text-purple-400">
                                  内心：{String(prl.thought)}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Right: events log */}
          <aside className="col-span-3">
            <div className="p-4 bg-white dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800">
              <h3 className="font-semibold text-sm mb-2">实时事件 (SSE)</h3>
              <div className="space-y-1 max-h-[70vh] overflow-auto text-xs">
                {events.length === 0 && (
                  <p className="text-zinc-500">暂无事件</p>
                )}
                {events.map((e) => (
                  <div
                    key={e.id}
                    className="p-2 border-l-2 border-zinc-200 dark:border-zinc-700"
                  >
                    <div className="flex justify-between">
                      <span className="font-mono">{e.type}</span>
                      <span className="text-zinc-400">
                        {new Date(e.ts).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
