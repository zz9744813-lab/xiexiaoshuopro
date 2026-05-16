'use client';

import { useEffect, useState } from 'react';

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
}

const DIRECTIVE_TYPES = [
  { value: 'inject_event', label: '注入事件 inject_event' },
  { value: 'add_memory', label: '植入记忆 add_memory' },
  { value: 'modify_world_state', label: '修改世界状态 modify_world_state' },
  { value: 'modify_character_state', label: '修改角色状态 modify_character_state' },
  { value: 'reveal_information', label: '公开信息 reveal_information' },
  { value: 'force_scene', label: '指定下一场景 force_scene' },
  { value: 'create_branch', label: '创建分支 create_branch' },
  { value: 'lock_fact', label: '锁定事实 lock_fact' },
  { value: 'adjust_tension', label: '调整戏剧强度 adjust_tension' },
  { value: 'approve_memory_write', label: '批准记忆写入 approve_memory_write' },
];

export default function DirectivesPage() {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [worldId, setWorldId] = useState('');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [type, setType] = useState('inject_event');
  const [mode, setMode] = useState<'soft' | 'hard'>('soft');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  // inject_event fields
  const [eventSummary, setEventSummary] = useState('');
  const [eventScene, setEventScene] = useState('');

  // add_memory fields
  const [memOwner, setMemOwner] = useState('');
  const [memContent, setMemContent] = useState('');
  const [memVisibility, setMemVisibility] = useState('private');
  const [memType, setMemType] = useState('episodic');
  const [memImportance, setMemImportance] = useState('0.7');

  // reveal_information fields
  const [revealText, setRevealText] = useState('');

  async function loadWorlds() {
    const r = await fetch('/api/worlds').then((x) => x.json());
    if (r.ok) {
      setWorlds(r.data);
      if (r.data.length && !worldId) setWorldId(r.data[0].id);
    }
  }
  async function loadAux() {
    if (!worldId) return;
    const [e, s] = await Promise.all([
      fetch(`/api/entities?world_id=${worldId}`).then((x) => x.json()),
      fetch(`/api/scenes/list?world_id=${worldId}`).then((x) => x.json()),
    ]);
    if (e.ok) setEntities(e.data);
    if (s.ok) setScenes(s.data);
  }

  useEffect(() => {
    void loadWorlds();
  }, []);
  useEffect(() => {
    void loadAux();
  }, [worldId]);

  async function submit() {
    const w = worlds.find((x) => x.id === worldId);
    if (!w?.defaultWorldlineId) {
      alert('世界没有 default_worldline');
      return;
    }
    let content: Record<string, unknown> = {};
    if (type === 'inject_event') {
      if (!eventSummary) {
        alert('请填事件摘要');
        return;
      }
      content = { summary: eventSummary, scene_id: eventScene || undefined };
    } else if (type === 'add_memory') {
      if (!memOwner || !memContent) {
        alert('请选择目标角色并填写记忆内容');
        return;
      }
      content = {
        owner_entity_id: memOwner,
        memory_type: memType,
        visibility: memVisibility,
        content: memContent,
        importance: Number(memImportance),
      };
    } else if (type === 'reveal_information') {
      content = { information: revealText };
    } else {
      content = {};
    }

    setBusy(true);
    try {
      const res = await fetch('/api/directives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worldId,
          worldlineId: w.defaultWorldlineId,
          directiveType: type,
          mode,
          content,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setResult(json.data);
        setEventSummary('');
        setMemContent('');
        setRevealText('');
      } else {
        alert(json.error?.message ?? '失败');
      }
    } finally {
      setBusy(false);
    }
  }

  const characters = entities.filter((e) => e.entityType === 'character');

  return (
    <main className="p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold">导演指令投放</h1>
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

        <p className="text-sm text-zinc-500 mb-6">
          soft = 主世界可解释/调整；hard = 强制改写世界事实（留 audit_log）。
          所有指令都不强迫角色按预定方式反应（spec § 28.3）。
        </p>

        <div className="p-6 bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">指令类型</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900 text-sm"
              >
                {DIRECTIVE_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">模式</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'soft' | 'hard')}
                className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900 text-sm"
              >
                <option value="soft">soft（建议）</option>
                <option value="hard">hard（强制）</option>
              </select>
            </div>
          </div>

          {type === 'inject_event' && (
            <div className="space-y-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <input
                type="text"
                placeholder="事件摘要（如：王都北区突然戒严）"
                value={eventSummary}
                onChange={(e) => setEventSummary(e.target.value)}
                maxLength={2000}
                className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900 text-sm"
              />
              <select
                value={eventScene}
                onChange={(e) => setEventScene(e.target.value)}
                className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900 text-sm"
              >
                <option value="">不绑定场景（取最近场景）</option>
                {scenes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title || s.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {type === 'add_memory' && (
            <div className="space-y-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <select
                value={memOwner}
                onChange={(e) => setMemOwner(e.target.value)}
                className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900 text-sm"
              >
                <option value="">选择目标角色</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <textarea
                placeholder="记忆内容"
                value={memContent}
                onChange={(e) => setMemContent(e.target.value)}
                maxLength={4000}
                rows={3}
                className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900 text-sm"
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={memType}
                  onChange={(e) => setMemType(e.target.value)}
                  className="px-3 py-2 border rounded bg-white dark:bg-zinc-900 text-sm"
                >
                  {[
                    'episodic',
                    'core_profile',
                    'inference',
                    'plan',
                    'secret',
                    'public_fact',
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <select
                  value={memVisibility}
                  onChange={(e) => setMemVisibility(e.target.value)}
                  className="px-3 py-2 border rounded bg-white dark:bg-zinc-900 text-sm"
                >
                  {['private', 'public', 'self_and_world', 'shared', 'world_only'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={memImportance}
                  onChange={(e) => setMemImportance(e.target.value)}
                  placeholder="importance 0-1"
                  className="px-3 py-2 border rounded bg-white dark:bg-zinc-900 text-sm"
                />
              </div>
            </div>
          )}

          {type === 'reveal_information' && (
            <div className="space-y-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <textarea
                placeholder="要公开的信息"
                value={revealText}
                onChange={(e) => setRevealText(e.target.value)}
                maxLength={2000}
                rows={3}
                className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900 text-sm"
              />
              <p className="text-xs text-zinc-500">
                注：此 directive_type 在 MVP 中暂未完全实现，会写入 audit_log 但 content 处理由后续 phase 完成。
              </p>
            </div>
          )}

          {!['inject_event', 'add_memory', 'reveal_information'].includes(type) && (
            <p className="text-sm text-zinc-500 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              此 directive_type 在 MVP 中暂未完全实现 content 处理。投放后会留 audit_log。
            </p>
          )}

          <button
            onClick={submit}
            disabled={busy || !worldId}
            className="px-4 py-2 bg-zinc-900 text-white rounded disabled:opacity-50"
          >
            {busy ? '投放中...' : `投放 ${mode} directive`}
          </button>
        </div>

        {result && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-300 dark:border-blue-800 rounded">
            <p className="font-medium text-sm mb-2">投放结果</p>
            <pre className="text-xs whitespace-pre-wrap break-words">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}
