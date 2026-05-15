'use client';

import { useEffect, useState } from 'react';

interface World {
  id: string;
  name: string;
}
interface MWRequest {
  id: string;
  proposedBy: string;
  proposedPayload: Record<string, unknown>;
  status: string;
  createdAt: string;
}

export default function MemoriesPage() {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [worldId, setWorldId] = useState('');
  const [requests, setRequests] = useState<MWRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'rejected' | 'applied'>('pending');

  async function loadWorlds() {
    const r = await fetch('/api/worlds').then((x) => x.json());
    if (r.ok) {
      setWorlds(r.data);
      if (r.data.length && !worldId) setWorldId(r.data[0].id);
    }
  }

  async function load() {
    if (!worldId) return;
    const r = await fetch(
      `/api/memory-requests?world_id=${worldId}&status=${statusFilter}`,
    ).then((x) => x.json());
    if (r.ok) setRequests(r.data);
  }

  useEffect(() => {
    void loadWorlds();
  }, []);
  useEffect(() => {
    void load();
  }, [worldId, statusFilter]);

  async function decide(id: string, decision: 'approve' | 'reject') {
    const res = await fetch('/api/memory-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, decision }),
    });
    const json = await res.json();
    if (json.ok) void load();
    else alert(json.error?.message ?? '失败');
  }

  return (
    <main className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold">记忆审批队列</h1>
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
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'pending' | 'rejected' | 'applied')
            }
            className="px-3 py-1 border rounded bg-white dark:bg-zinc-900"
          >
            <option value="pending">待审批</option>
            <option value="applied">已批准</option>
            <option value="rejected">已拒绝</option>
          </select>
        </div>

        <p className="text-sm text-zinc-500 mb-4">
          novelizer 提议的记忆必须经此队列审批后才能进入正式记忆库。
        </p>

        {requests.length === 0 ? (
          <p className="text-zinc-500">暂无 {statusFilter} 请求。</p>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => {
              const p = r.proposedPayload;
              return (
                <li
                  key={r.id}
                  className="p-4 bg-white dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800"
                >
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-zinc-500">
                      来源：{r.proposedBy} · {new Date(r.createdAt).toLocaleString()}
                    </span>
                    <span className="text-xs text-zinc-500">{r.status}</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <div>
                      <span className="font-medium">归属：</span>
                      {String(p.owner_entity_id ?? '-')}
                    </div>
                    <div>
                      <span className="font-medium">类型：</span>
                      {String(p.memory_type ?? '-')} ·{' '}
                      <span className="font-medium">可见性：</span>
                      {String(p.visibility ?? '-')}
                    </div>
                    <div className="mt-2 p-2 bg-zinc-50 dark:bg-zinc-900 rounded">
                      {String(p.content ?? '')}
                    </div>
                  </div>
                  {r.status === 'pending' && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => decide(r.id, 'approve')}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded"
                      >
                        批准
                      </button>
                      <button
                        onClick={() => decide(r.id, 'reject')}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded"
                      >
                        拒绝
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
