'use client';

import { useEffect, useState } from 'react';

interface World {
  id: string;
  name: string;
}
interface Trace {
  id: string;
  traceType: string;
  phase?: string | null;
  entityId?: string | null;
  roundId?: string | null;
  status: string;
  errorMessage?: string | null;
  tokenInput?: number | null;
  tokenOutput?: number | null;
  latencyMs?: number | null;
  createdAt: string;
}

export default function TracesPage() {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [worldId, setWorldId] = useState('');
  const [traces, setTraces] = useState<Trace[]>([]);
  const [activeTrace, setActiveTrace] = useState<Record<string, unknown> | null>(null);

  async function loadWorlds() {
    const r = await fetch('/api/worlds').then((x) => x.json());
    if (r.ok) {
      setWorlds(r.data);
      if (r.data.length && !worldId) setWorldId(r.data[0].id);
    }
  }

  async function loadTraces() {
    if (!worldId) return;
    const r = await fetch(`/api/traces?world_id=${worldId}&limit=200`).then((x) => x.json());
    if (r.ok) setTraces(r.data);
  }

  async function openTrace(id: string) {
    const r = await fetch(`/api/traces/${id}`).then((x) => x.json());
    if (r.ok) setActiveTrace(r.data);
  }

  async function replay(id: string) {
    const r = await fetch(`/api/traces/${id}/replay`, { method: 'POST' }).then((x) => x.json());
    if (r.ok) {
      alert('Replay 完成，新 trace ID: ' + r.data.replay_trace_id);
      void loadTraces();
    } else {
      alert('Replay 失败：' + (r.error?.message ?? ''));
    }
  }

  useEffect(() => {
    void loadWorlds();
  }, []);
  useEffect(() => {
    void loadTraces();
  }, [worldId]);

  return (
    <main className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold">Trace 调试</h1>
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
          <button
            onClick={() => loadTraces()}
            className="ml-auto px-3 py-1 text-sm border rounded"
          >
            刷新
          </button>
        </div>

        <div className="grid grid-cols-12 gap-4">
          <aside className="col-span-5">
            <div className="bg-white dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 max-h-[80vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    <th className="px-2 py-2 text-left">类型</th>
                    <th className="px-2 py-2 text-left">阶段</th>
                    <th className="px-2 py-2 text-left">状态</th>
                    <th className="px-2 py-2 text-right">tokens</th>
                    <th className="px-2 py-2 text-right">ms</th>
                    <th className="px-2 py-2 text-left">时间</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {traces.map((t) => (
                    <tr
                      key={t.id}
                      className="border-t border-zinc-100 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
                      onClick={() => openTrace(t.id)}
                    >
                      <td className="px-2 py-1 font-mono text-xs">{t.traceType}</td>
                      <td className="px-2 py-1 text-xs">{t.phase ?? '-'}</td>
                      <td
                        className={`px-2 py-1 text-xs ${
                          t.status === 'success'
                            ? 'text-green-600'
                            : t.status === 'schema_error'
                              ? 'text-yellow-600'
                              : 'text-red-600'
                        }`}
                      >
                        {t.status}
                      </td>
                      <td className="px-2 py-1 text-xs text-right">
                        {t.tokenInput ?? '-'}/{t.tokenOutput ?? '-'}
                      </td>
                      <td className="px-2 py-1 text-xs text-right">
                        {t.latencyMs ?? '-'}
                      </td>
                      <td className="px-2 py-1 text-xs text-zinc-500">
                        {new Date(t.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="px-2 py-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void replay(t.id);
                          }}
                          className="text-xs text-blue-600"
                        >
                          replay
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </aside>

          <section className="col-span-7">
            <div className="bg-white dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 p-4 max-h-[80vh] overflow-auto">
              {!activeTrace ? (
                <p className="text-zinc-500 text-sm">点击左侧 trace 查看详情</p>
              ) : (
                <pre className="text-xs whitespace-pre-wrap break-words">
                  {JSON.stringify(activeTrace, null, 2)}
                </pre>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
