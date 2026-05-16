'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface World {
  id: string;
  name: string;
  defaultWorldlineId?: string | null;
}

interface Chapter {
  id: string;
  chapterIndex: number;
  title: string;
  faithfulnessScore?: string | null;
  changedMajorFacts: string[];
  status: string;
  createdAt: string;
}

interface SimEvent {
  id: string;
  title?: string | null;
  canonicalSummary: string;
  eventLevel: string;
  createdAt: string;
}

export default function ChaptersPage() {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [worldId, setWorldId] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [pov, setPov] = useState<'third_person_limited' | 'third_person_omniscient' | 'first_person'>(
    'third_person_limited',
  );
  const [busy, setBusy] = useState(false);

  async function loadWorlds() {
    const r = await fetch('/api/worlds').then((x) => x.json());
    if (r.ok) {
      setWorlds(r.data);
      if (r.data.length && !worldId) setWorldId(r.data[0].id);
    }
  }

  async function loadChapters() {
    if (!worldId) return;
    const r = await fetch(`/api/chapters?world_id=${worldId}`).then((x) => x.json());
    if (r.ok) setChapters(r.data);
  }

  async function loadEvents() {
    if (!worldId) return;
    // Load events from all scenes via scene rounds API; simple list endpoint not built
    // Use scenes list and gather events
    const sceneRes = await fetch(`/api/scenes/list?world_id=${worldId}`).then((x) => x.json());
    if (!sceneRes.ok) return;
    const allEvents: SimEvent[] = [];
    for (const scene of sceneRes.data) {
      const rr = await fetch(`/api/scenes/${scene.id}/rounds`).then((x) => x.json());
      if (rr.ok) {
        // Note: /scenes/[id]/rounds returns rounds+actions, not events directly
        // For now, fall back to listing scenes only
        void rr;
      }
    }
    setEvents(allEvents);
  }

  useEffect(() => {
    void loadWorlds();
  }, []);
  useEffect(() => {
    void loadChapters();
    void loadEvents();
  }, [worldId]);

  async function generate() {
    const world = worlds.find((w) => w.id === worldId);
    if (!world?.defaultWorldlineId) return;
    if (selectedEventIds.length === 0) {
      // For demo, prompt user to paste event IDs comma-separated
      const input = prompt(
        '粘贴 source event ids（逗号分隔）。\n稍后将提供 UI 选择器。',
      );
      if (!input) return;
      const ids = input
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (ids.length === 0) return;
      setSelectedEventIds(ids);
      await doGenerate(ids, world.defaultWorldlineId);
      return;
    }
    await doGenerate(selectedEventIds, world.defaultWorldlineId);
  }

  async function doGenerate(eventIds: string[], worldlineId: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/chapters/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worldId,
          worldlineId,
          sourceEventIds: eventIds,
          pov,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        const w = json.data.warnings ?? [];
        alert(
          `章节已生成。忠实度 ${(json.data.faithfulnessScore * 100).toFixed(0)}%。\n` +
            (w.length > 0 ? '警告：\n' + w.join('\n') : ''),
        );
        void loadChapters();
      } else {
        alert(json.error?.message ?? '失败');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold">小说章节</h1>
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
            value={pov}
            onChange={(e) =>
              setPov(
                e.target.value as
                  | 'third_person_limited'
                  | 'third_person_omniscient'
                  | 'first_person',
              )
            }
            className="px-3 py-1 border rounded bg-white dark:bg-zinc-900 text-sm"
          >
            <option value="third_person_limited">三人称限制</option>
            <option value="third_person_omniscient">三人称全知</option>
            <option value="first_person">第一人称</option>
          </select>
          <button
            onClick={generate}
            disabled={busy || !worldId}
            className="px-3 py-1 text-sm bg-zinc-900 text-white rounded disabled:opacity-50"
          >
            {busy ? '生成中...' : '生成章节'}
          </button>
        </div>

        <p className="text-sm text-zinc-500 mb-4">
          narrator 实体读取场景中所有公开行为、私密心理和世界日志，按文学方式整理章节。
          忠实度自动检测：如果章节包含未在 source events 中出现的关键实体或把被打断的台词写成已说出，
          状态将保持 draft 等待人工复核。
        </p>

        {chapters.length === 0 ? (
          <p className="text-zinc-500">还没有章节。先在模拟控制台跑几个场景，再来这里生成。</p>
        ) : (
          <ul className="space-y-2">
            {chapters.map((c) => {
              const score = c.faithfulnessScore ? Number(c.faithfulnessScore) : 0;
              const scoreColor =
                score >= 0.85
                  ? 'text-green-600'
                  : score >= 0.6
                    ? 'text-yellow-600'
                    : 'text-red-600';
              return (
                <li
                  key={c.id}
                  className="p-4 bg-white dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium">
                      第 {c.chapterIndex + 1} 章 · {c.title}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {new Date(c.createdAt).toLocaleString()} ·{' '}
                      <span className={scoreColor}>
                        忠实度 {(score * 100).toFixed(0)}%
                      </span>{' '}
                      · 状态 {c.status}
                      {c.changedMajorFacts.length > 0 && (
                        <span className="ml-2 text-red-600">
                          ⚠ {c.changedMajorFacts.length} 个事实警告
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/chapters/${c.id}`}
                      className="px-3 py-1 text-sm border rounded hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    >
                      查看
                    </Link>
                    <a
                      href={`/api/chapters/${c.id}/export`}
                      className="px-3 py-1 text-sm border rounded hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    >
                      下载 .md
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
