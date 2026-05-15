'use client';

import { useEffect, useState } from 'react';

interface World {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  name: string;
  model: string;
}

interface Entity {
  id: string;
  name: string;
  entityType: string;
  apiProfileId?: string | null;
  status: string;
}

export default function CharactersPage() {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [worldId, setWorldId] = useState<string>('');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    entityType: 'character',
    apiProfileId: '',
    publicIdentity: '',
    appearance: '',
    personality: '',
    coreDesire: '',
    fears: '',
    sampleLines: '',
    forbiddenPhrases: '',
    perception: 50,
    stealth: 30,
    socialInsight: 50,
    combat: 30,
    mobility: 50,
  });

  async function load() {
    const w = await fetch('/api/worlds').then((r) => r.json());
    if (w.ok) {
      setWorlds(w.data);
      if (w.data.length && !worldId) setWorldId(w.data[0].id);
    }
    const p = await fetch('/api/profiles').then((r) => r.json());
    if (p.ok) setProfiles(p.data);
  }

  async function loadEntities() {
    if (!worldId) return;
    const e = await fetch(`/api/entities?world_id=${worldId}`).then((r) => r.json());
    if (e.ok) setEntities(e.data);
  }

  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    void loadEntities();
  }, [worldId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!worldId) {
      setError('请先选择世界');
      return;
    }
    const payload: Record<string, unknown> = {
      worldId,
      entityType: form.entityType,
      name: form.name,
      apiProfileId: form.apiProfileId || undefined,
    };
    if (form.entityType === 'character') {
      payload.characterProfile = {
        publicProfile: {
          name: form.name,
          public_identity: form.publicIdentity || undefined,
          appearance: form.appearance || undefined,
        },
        privateProfile: {
          personality: form.personality || undefined,
        },
        speechStyle: {
          sample_lines: form.sampleLines
            ? form.sampleLines.split('\n').filter(Boolean).slice(0, 20)
            : [],
          forbidden_phrases: form.forbiddenPhrases
            ? form.forbiddenPhrases.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 50)
            : [],
        },
        desireProfile: {
          core_desire: form.coreDesire || undefined,
          fears: form.fears
            ? form.fears.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
        },
        abilityProfile: {
          perception: Number(form.perception),
          stealth: Number(form.stealth),
          social_insight: Number(form.socialInsight),
          combat: Number(form.combat),
          mobility: Number(form.mobility),
        },
      };
    }
    const res = await fetch('/api/entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.ok) {
      setForm({ ...form, name: '' });
      void loadEntities();
    } else {
      setError(json.error?.message ?? 'Failed');
    }
  }

  return (
    <main className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">角色管理</h1>

        <div className="mb-4">
          <label className="text-sm mr-2">世界：</label>
          <select
            value={worldId}
            onChange={(e) => setWorldId(e.target.value)}
            className="px-3 py-2 border rounded bg-white dark:bg-zinc-900"
          >
            {worlds.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        <form
          onSubmit={create}
          className="mb-8 p-6 bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-3"
        >
          <h2 className="font-semibold mb-2">创建实体</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={form.entityType}
              onChange={(e) => setForm({ ...form, entityType: e.target.value })}
              className="px-3 py-2 border rounded bg-white dark:bg-zinc-900"
            >
              <option value="character">角色 character</option>
              <option value="world_agent">主世界 world_agent</option>
              <option value="narrator">小说整理器 narrator</option>
              <option value="faction">势力 faction</option>
              <option value="location">地点 location</option>
            </select>
            <input
              type="text"
              placeholder="名称"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              maxLength={80}
              className="px-3 py-2 border rounded bg-white dark:bg-zinc-900"
            />
            <select
              value={form.apiProfileId}
              onChange={(e) => setForm({ ...form, apiProfileId: e.target.value })}
              className="px-3 py-2 border rounded bg-white dark:bg-zinc-900 col-span-2"
            >
              <option value="">不绑定 API Profile</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.model})
                </option>
              ))}
            </select>
          </div>

          {form.entityType === 'character' && (
            <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <h3 className="font-medium text-sm">角色细节</h3>
              <input
                type="text"
                placeholder="公开身份（如：黑市情报商）"
                value={form.publicIdentity}
                onChange={(e) => setForm({ ...form, publicIdentity: e.target.value })}
                className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900"
              />
              <input
                type="text"
                placeholder="外观描述"
                value={form.appearance}
                onChange={(e) => setForm({ ...form, appearance: e.target.value })}
                className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900"
              />
              <textarea
                placeholder="性格 / 私密设定（不会暴露给其他角色）"
                value={form.personality}
                onChange={(e) => setForm({ ...form, personality: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900"
              />
              <input
                type="text"
                placeholder="核心欲望"
                value={form.coreDesire}
                onChange={(e) => setForm({ ...form, coreDesire: e.target.value })}
                className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900"
              />
              <input
                type="text"
                placeholder="恐惧（逗号分隔）"
                value={form.fears}
                onChange={(e) => setForm({ ...form, fears: e.target.value })}
                className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900"
              />
              <textarea
                placeholder="样本台词（每行一条，最多 20 条）"
                value={form.sampleLines}
                onChange={(e) => setForm({ ...form, sampleLines: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900"
              />
              <input
                type="text"
                placeholder="禁忌词汇（逗号分隔，如：其实,真正,心里）"
                value={form.forbiddenPhrases}
                onChange={(e) => setForm({ ...form, forbiddenPhrases: e.target.value })}
                className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900"
              />
              <div className="grid grid-cols-5 gap-2">
                {(['perception', 'stealth', 'socialInsight', 'combat', 'mobility'] as const).map(
                  (k) => (
                    <label key={k} className="text-xs">
                      <span className="block text-zinc-500 mb-1">{k}</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={form[k]}
                        onChange={(e) =>
                          setForm({ ...form, [k]: Number(e.target.value) })
                        }
                        className="w-full px-2 py-1 border rounded bg-white dark:bg-zinc-900"
                      />
                    </label>
                  ),
                )}
              </div>
            </div>
          )}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="px-4 py-2 bg-zinc-900 text-white rounded hover:bg-zinc-700"
          >
            创建
          </button>
        </form>

        <h2 className="font-semibold mb-3">已有实体</h2>
        {entities.length === 0 ? (
          <p className="text-zinc-500">还没有实体。</p>
        ) : (
          <ul className="space-y-2">
            {entities.map((e) => (
              <li
                key={e.id}
                className="p-3 bg-white dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 flex justify-between items-center"
              >
                <div>
                  <span className="font-medium">{e.name}</span>
                  <span className="ml-2 text-xs text-zinc-500">{e.entityType}</span>
                </div>
                <span
                  className={`text-xs ${
                    e.status === 'active' ? 'text-green-600' : 'text-zinc-400'
                  }`}
                >
                  {e.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
