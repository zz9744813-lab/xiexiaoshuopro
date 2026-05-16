'use client';

import { useEffect, useState } from 'react';

interface World {
  id: string;
  name: string;
}

interface PromptVersion {
  id: string;
  name: string;
  promptType: string;
  version: string;
  content: string;
  status: string;
  worldId?: string | null;
  createdAt: string;
}

const PROMPT_TYPES = [
  'character_system',
  'world_agent_system',
  'novelizer_system',
  'memory_summarizer',
  'audit_checker',
  'json_repair',
  'drift_detector',
];

export default function PromptsPage() {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [worldId, setWorldId] = useState('');
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [active, setActive] = useState<PromptVersion | null>(null);
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({
    name: '',
    promptType: 'character_system',
    version: 'v1',
    content: '',
  });

  async function loadWorlds() {
    const r = await fetch('/api/worlds').then((x) => x.json());
    if (r.ok) {
      setWorlds(r.data);
      if (r.data.length && !worldId) setWorldId(r.data[0].id);
    }
  }

  async function loadPrompts() {
    if (!worldId) return;
    const r = await fetch(`/api/prompt-versions?world_id=${worldId}`).then((x) => x.json());
    if (r.ok) setPrompts(r.data);
  }

  useEffect(() => {
    void loadWorlds();
  }, []);
  useEffect(() => {
    void loadPrompts();
  }, [worldId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!worldId) return;
    const res = await fetch('/api/prompt-versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worldId,
        ...form,
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setForm({ ...form, name: '', content: '' });
      setEditing(false);
      void loadPrompts();
    } else {
      alert(json.error?.message ?? 'Failed');
    }
  }

  return (
    <main className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold">Prompt 版本管理</h1>
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
            onClick={() => setEditing(!editing)}
            className="ml-auto px-3 py-1 text-sm border rounded"
          >
            {editing ? '取消' : '+ 新版本'}
          </button>
        </div>

        <p className="text-sm text-zinc-500 mb-4">
          所有 prompt 必须版本化。修改不覆盖旧版本（spec § 26.1）。Trace 会记录使用的 prompt_version_id。
        </p>

        {editing && (
          <form
            onSubmit={create}
            className="mb-6 p-4 bg-white dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 space-y-3"
          >
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="名称"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                maxLength={80}
                className="px-3 py-2 border rounded bg-white dark:bg-zinc-900 text-sm"
              />
              <select
                value={form.promptType}
                onChange={(e) => setForm({ ...form, promptType: e.target.value })}
                className="px-3 py-2 border rounded bg-white dark:bg-zinc-900 text-sm"
              >
                {PROMPT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="版本（如 v2）"
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                required
                maxLength={40}
                className="px-3 py-2 border rounded bg-white dark:bg-zinc-900 text-sm"
              />
            </div>
            <textarea
              placeholder="Prompt 内容"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              required
              maxLength={100000}
              rows={12}
              className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900 font-mono text-xs"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-zinc-900 text-white rounded text-sm"
            >
              创建
            </button>
          </form>
        )}

        <div className="grid grid-cols-12 gap-4">
          <aside className="col-span-5">
            <h2 className="font-semibold text-sm mb-2">已有版本</h2>
            {prompts.length === 0 ? (
              <p className="text-zinc-500 text-sm">暂无</p>
            ) : (
              <ul className="space-y-1">
                {prompts.map((p) => (
                  <li
                    key={p.id}
                    onClick={() => setActive(p)}
                    className={`p-2 text-sm rounded cursor-pointer ${
                      active?.id === p.id
                        ? 'bg-zinc-900 text-white'
                        : 'bg-white dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex justify-between">
                      <span>{p.name}</span>
                      <span className="opacity-70 text-xs">{p.version}</span>
                    </div>
                    <div className="text-xs opacity-70">{p.promptType}</div>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section className="col-span-7">
            {active ? (
              <div className="bg-white dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 p-4">
                <div className="flex justify-between mb-2">
                  <div>
                    <h3 className="font-semibold">
                      {active.name} <span className="text-xs text-zinc-500">{active.version}</span>
                    </h3>
                    <p className="text-xs text-zinc-500">{active.promptType}</p>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {new Date(active.createdAt).toLocaleString()}
                  </span>
                </div>
                <pre className="text-xs whitespace-pre-wrap break-words bg-zinc-50 dark:bg-zinc-900 p-3 rounded max-h-[60vh] overflow-auto">
                  {active.content}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">点击左侧版本查看内容</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
