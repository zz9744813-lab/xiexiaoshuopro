'use client';

import { useEffect, useState } from 'react';

interface Provider {
  id: string;
  displayName: string;
  providerType: string;
}

interface Profile {
  id: string;
  name: string;
  model: string;
  providerId: string;
  temperature?: string | null;
  maxTokens?: number | null;
  responseFormat?: string | null;
  timeoutSeconds: number;
  retryCount: number;
}

export default function ProfilesPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    providerId: '',
    name: '',
    model: '',
    temperature: '0.7',
    maxTokens: '2000',
    responseFormat: 'json',
    timeoutSeconds: '60',
    retryCount: '2',
  });

  async function load() {
    const [pp, pr] = await Promise.all([
      fetch('/api/providers').then((r) => r.json()),
      fetch('/api/profiles').then((r) => r.json()),
    ]);
    if (pp.ok) setProviders(pp.data);
    if (pr.ok) setProfiles(pr.data);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      providerId: form.providerId,
      name: form.name,
      model: form.model,
      temperature: form.temperature ? Number(form.temperature) : undefined,
      maxTokens: form.maxTokens ? Number(form.maxTokens) : undefined,
      responseFormat: form.responseFormat,
      timeoutSeconds: form.timeoutSeconds ? Number(form.timeoutSeconds) : undefined,
      retryCount: form.retryCount ? Number(form.retryCount) : undefined,
    };
    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.ok) {
      setForm({ ...form, name: '', model: '' });
      void load();
    } else {
      setError(json.error?.message ?? 'Failed');
    }
  }

  return (
    <main className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">API Profile 配置</h1>
        <p className="text-sm text-zinc-500 mb-6">
          一个 Profile = Provider + 模型 + 参数。角色绑定到 Profile，不直接绑定到 Provider。
        </p>

        <form
          onSubmit={create}
          className="mb-8 p-6 bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-3"
        >
          <h2 className="font-semibold mb-2">添加 Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={form.providerId}
              onChange={(e) => setForm({ ...form, providerId: e.target.value })}
              required
              className="px-3 py-2 border rounded bg-white dark:bg-zinc-900"
            >
              <option value="">选择 Provider</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName} ({p.providerType})
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="名称（如：冷静主角模型）"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              maxLength={80}
              className="px-3 py-2 border rounded bg-white dark:bg-zinc-900"
            />
            <input
              type="text"
              placeholder="Model（如：gpt-4o-mini）"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              required
              maxLength={200}
              className="px-3 py-2 border rounded bg-white dark:bg-zinc-900"
            />
            <select
              value={form.responseFormat}
              onChange={(e) => setForm({ ...form, responseFormat: e.target.value })}
              className="px-3 py-2 border rounded bg-white dark:bg-zinc-900"
            >
              <option value="json">JSON</option>
              <option value="text">Text</option>
            </select>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              placeholder="Temperature"
              value={form.temperature}
              onChange={(e) => setForm({ ...form, temperature: e.target.value })}
              className="px-3 py-2 border rounded bg-white dark:bg-zinc-900"
            />
            <input
              type="number"
              min="1"
              max="100000"
              placeholder="Max tokens"
              value={form.maxTokens}
              onChange={(e) => setForm({ ...form, maxTokens: e.target.value })}
              className="px-3 py-2 border rounded bg-white dark:bg-zinc-900"
            />
            <input
              type="number"
              min="1"
              max="600"
              placeholder="Timeout (sec)"
              value={form.timeoutSeconds}
              onChange={(e) => setForm({ ...form, timeoutSeconds: e.target.value })}
              className="px-3 py-2 border rounded bg-white dark:bg-zinc-900"
            />
            <input
              type="number"
              min="0"
              max="10"
              placeholder="Retry count"
              value={form.retryCount}
              onChange={(e) => setForm({ ...form, retryCount: e.target.value })}
              className="px-3 py-2 border rounded bg-white dark:bg-zinc-900"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="px-4 py-2 bg-zinc-900 text-white rounded hover:bg-zinc-700"
          >
            创建 Profile
          </button>
        </form>

        <h2 className="font-semibold mb-3">已有 Profile</h2>
        {profiles.length === 0 ? (
          <p className="text-zinc-500">还没有 Profile。</p>
        ) : (
          <div className="space-y-2">
            {profiles.map((p) => {
              const prov = providers.find((pp) => pp.id === p.providerId);
              return (
                <div
                  key={p.id}
                  className="p-4 bg-white dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-sm text-zinc-500">
                        {prov?.displayName} · {p.model}
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">
                        T={p.temperature ?? '-'} · max={p.maxTokens ?? '-'} ·
                        timeout={p.timeoutSeconds}s · retry={p.retryCount} ·
                        format={p.responseFormat}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
