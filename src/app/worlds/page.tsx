'use client';

import { useEffect, useState } from 'react';

interface World {
  id: string;
  name: string;
  description?: string | null;
  genre?: string | null;
  defaultWorldlineId?: string | null;
  createdAt: string;
}

export default function WorldsPage() {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/worlds');
      const json = await res.json();
      if (json.ok) setWorlds(json.data);
      else setError(json.error?.message ?? 'Failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/worlds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, genre }),
    });
    const json = await res.json();
    if (json.ok) {
      setName('');
      setDescription('');
      setGenre('');
      void load();
    } else {
      setError(json.error?.message ?? 'Failed');
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">世界管理</h1>

        <form
          onSubmit={create}
          className="mb-8 p-6 bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-3"
        >
          <h2 className="font-semibold mb-2">创建新世界</h2>
          <input
            type="text"
            placeholder="世界名（最多 120 字符）"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            required
            className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900"
          />
          <input
            type="text"
            placeholder="类型（可选，如：玄幻、都市、悬疑）"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900"
          />
          <textarea
            placeholder="世界观描述（可选）"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={4000}
            rows={4}
            className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="px-4 py-2 bg-zinc-900 text-white rounded hover:bg-zinc-700"
          >
            创建世界
          </button>
        </form>

        <h2 className="font-semibold mb-3">已有世界</h2>
        {loading ? (
          <p className="text-zinc-500">加载中...</p>
        ) : worlds.length === 0 ? (
          <p className="text-zinc-500">还没有世界，先创建一个吧。</p>
        ) : (
          <ul className="space-y-2">
            {worlds.map((w) => (
              <li
                key={w.id}
                className="p-4 bg-white dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">{w.name}</p>
                    {w.genre && (
                      <p className="text-sm text-zinc-500">{w.genre}</p>
                    )}
                    {w.description && (
                      <p className="text-sm text-zinc-600 mt-1">{w.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400">
                    {new Date(w.createdAt).toLocaleString()}
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
