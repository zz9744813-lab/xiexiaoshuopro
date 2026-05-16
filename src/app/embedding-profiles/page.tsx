'use client';

import { useEffect, useState } from 'react';

interface World {
  id: string;
  name: string;
  defaultEmbeddingProfileId?: string | null;
}

interface Provider {
  id: string;
  displayName: string;
  providerType: string;
}

interface EmbProfile {
  id: string;
  worldId?: string | null;
  providerId?: string | null;
  name: string;
  model: string;
  dimension: number;
  distanceMetric: string;
  createdAt: string;
}

const COMMON_MODELS = [
  { model: 'text-embedding-3-small', dim: 1536 },
  { model: 'text-embedding-3-large', dim: 3072 },
  { model: 'text-embedding-ada-002', dim: 1536 },
  { model: 'voyage-3', dim: 1024 },
  { model: 'nomic-embed-text', dim: 768 },
];

export default function EmbeddingProfilesPage() {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [worldId, setWorldId] = useState('');
  const [profiles, setProfiles] = useState<EmbProfile[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [form, setForm] = useState({
    name: '',
    providerId: '',
    model: 'text-embedding-3-small',
    dimension: '1536',
  });
  const [error, setError] = useState<string | null>(null);

  async function loadWorlds() {
    const r = await fetch('/api/worlds').then((x) => x.json());
    if (r.ok) {
      setWorlds(r.data);
      if (r.data.length && !worldId) setWorldId(r.data[0].id);
    }
  }
  async function loadProfiles() {
    if (!worldId) return;
    const r = await fetch(`/api/embedding-profiles?world_id=${worldId}`).then((x) => x.json());
    if (r.ok) setProfiles(r.data);
  }
  async function loadProviders() {
    const r = await fetch('/api/providers').then((x) => x.json());
    if (r.ok) setProviders(r.data);
  }
  useEffect(() => {
    void loadWorlds();
    void loadProviders();
  }, []);
  useEffect(() => {
    void loadProfiles();
  }, [worldId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!worldId) return;
    const confirmed = confirm(
      '⚠ 切换 embedding profile 会触发该 world 全部 memory.embedding 重建。\n\n确定继续？',
    );
    if (!confirmed) return;

    const res = await fetch('/api/embedding-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worldId,
        providerId: form.providerId,
        name: form.name,
        model: form.model,
        dimension: Number(form.dimension),
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setForm({ ...form, name: '' });
      void loadProfiles();
    } else {
      setError(json.error?.message ?? 'Failed');
    }
  }

  const world = worlds.find((w) => w.id === worldId);

  return (
    <main className="p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold">Embedding Profile</h1>
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
        </div>

        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-300 dark:border-yellow-800 rounded text-sm">
          <p className="font-medium mb-1">⚠ 切换警告（spec § 32.18）</p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            每个 world 内部必须使用同一 embedding 模型与维度。memories.embedding 的维度必须与
            world 的 embedding_profile.dimension 严格一致。切换 embedding 模型必须触发该 world
            所有 memory 的 embedding 重建（建议先 fork worldline 再切换）。
          </p>
        </div>

        <form
          onSubmit={create}
          className="mb-6 p-4 bg-white dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 space-y-3"
        >
          <h2 className="font-semibold text-sm">新建 / 切换 Embedding Profile</h2>
          <input
            type="text"
            placeholder="名称"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            maxLength={80}
            className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900 text-sm"
          />
          <select
            value={form.providerId}
            onChange={(e) => setForm({ ...form, providerId: e.target.value })}
            required
            className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900 text-sm"
          >
            <option value="">选择 Provider（必须支持 /embeddings）</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName} ({p.providerType})
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.model}
              onChange={(e) => {
                const m = COMMON_MODELS.find((x) => x.model === e.target.value);
                setForm({
                  ...form,
                  model: e.target.value,
                  dimension: m ? String(m.dim) : form.dimension,
                });
              }}
              className="px-3 py-2 border rounded bg-white dark:bg-zinc-900 text-sm"
            >
              {COMMON_MODELS.map((m) => (
                <option key={m.model} value={m.model}>
                  {m.model}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="64"
              max="8192"
              value={form.dimension}
              onChange={(e) => setForm({ ...form, dimension: e.target.value })}
              required
              className="px-3 py-2 border rounded bg-white dark:bg-zinc-900 text-sm"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="px-4 py-2 bg-zinc-900 text-white rounded text-sm"
          >
            创建并设为该 world 默认
          </button>
        </form>

        <h2 className="font-semibold text-sm mb-2">已有 Profile</h2>
        {profiles.length === 0 ? (
          <p className="text-zinc-500 text-sm">暂无</p>
        ) : (
          <ul className="space-y-2">
            {profiles.map((p) => (
              <li
                key={p.id}
                className="p-3 bg-white dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex justify-between">
                  <div>
                    <span className="font-medium">{p.name}</span>
                    {world?.defaultEmbeddingProfileId === p.id && (
                      <span className="ml-2 text-xs text-green-600">● 当前默认</span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">
                    {p.model} · {p.dimension}d · {p.distanceMetric}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
