'use client';

import { useEffect, useState } from 'react';

interface Provider {
  id: string;
  displayName: string;
  providerType: string;
  baseUrl?: string | null;
  status: string;
  createdAt: string;
}

const PROVIDER_TYPES = [
  'openai',
  'anthropic',
  'gemini',
  'deepseek',
  'mistral',
  'openrouter',
  'ollama',
  'openai_compatible',
];

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    displayName: '',
    providerType: 'openai',
    baseUrl: '',
    apiKey: '',
  });

  async function load() {
    setLoading(true);
    const res = await fetch('/api/providers');
    const json = await res.json();
    if (json.ok) setProviders(json.data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (json.ok) {
      setForm({ displayName: '', providerType: 'openai', baseUrl: '', apiKey: '' });
      void load();
    } else {
      setError(json.error?.message ?? 'Failed');
    }
  }

  async function testConn(id: string) {
    const res = await fetch(`/api/providers/${id}/test`, { method: 'POST' });
    const json = await res.json();
    alert(json.ok && json.data?.ok ? '连接成功' : '连接失败');
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">API Provider 配置</h1>
        <p className="text-sm text-zinc-500 mb-6">
          API Key 仅提交到后端加密存储，不会出现在前端、prompt、trace 或日志中。
        </p>

        <form
          onSubmit={create}
          className="mb-8 p-6 bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-3"
        >
          <h2 className="font-semibold mb-2">添加 Provider</h2>
          <input
            type="text"
            placeholder="显示名（如 OpenAI 主账号）"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            required
            maxLength={80}
            className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900"
          />
          <select
            value={form.providerType}
            onChange={(e) => setForm({ ...form, providerType: e.target.value })}
            className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900"
          >
            {PROVIDER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Base URL（可选，例如 https://api.openai.com/v1）"
            value={form.baseUrl}
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            maxLength={500}
            className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900"
          />
          <input
            type="password"
            placeholder="API Key"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            required
            className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="px-4 py-2 bg-zinc-900 text-white rounded hover:bg-zinc-700"
          >
            添加
          </button>
        </form>

        <h2 className="font-semibold mb-3">已有 Provider</h2>
        {loading ? (
          <p className="text-zinc-500">加载中...</p>
        ) : providers.length === 0 ? (
          <p className="text-zinc-500">还没有 Provider。</p>
        ) : (
          <ul className="space-y-2">
            {providers.map((p) => (
              <li
                key={p.id}
                className="p-4 bg-white dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 flex justify-between items-center"
              >
                <div>
                  <p className="font-medium">{p.displayName}</p>
                  <p className="text-sm text-zinc-500">
                    {p.providerType} {p.baseUrl && `· ${p.baseUrl}`}
                  </p>
                </div>
                <button
                  onClick={() => testConn(p.id)}
                  className="px-3 py-1 text-sm border rounded hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  测试连接
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
