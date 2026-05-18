'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ChatView from './_components/ChatView';
import TimelineView from './_components/TimelineView';
import ControlPanel from './_components/ControlPanel';
import EventDrawer from './_components/EventDrawer';
import { useSimulationStream } from './_hooks/useSimulationStream';
import type { World, Entity, Scene, Round, Action, SimulationRun, ApiProfile } from './_lib/types';

export default function SimulationV2Page() {
  // --- Layout state (folding) ---
  const [topbarOpen, setTopbarOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState<'chat' | 'timeline'>('chat');
  const [immersive, setImmersive] = useState(false);

  // --- Data state ---
  const [worlds, setWorlds] = useState<World[]>([]);
  const [worldId, setWorldId] = useState('');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [profiles, setProfiles] = useState<ApiProfile[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState('');
  const [costs, setCosts] = useState<{ today?: { cost: number } }>({});
  const [participantsForm, setParticipantsForm] = useState<string[]>([]);
  const [sceneTitle, setSceneTitle] = useState('');
  const [perspective, setPerspective] = useState<'author' | string>('author');

  // --- Loaders ---
  const loadWorlds = useCallback(async () => {
    const r = await fetch('/api/worlds').then((x) => x.json());
    if (r.ok) {
      setWorlds(r.data);
      if (r.data.length && !worldId) setWorldId(r.data[0].id);
    }
  }, [worldId]);

  const loadProfiles = useCallback(async () => {
    const r = await fetch('/api/profiles').then((x) => x.json());
    if (r.ok) setProfiles(r.data);
  }, []);

  const loadWorldData = useCallback(async () => {
    if (!worldId) return;
    const [e, s, c] = await Promise.all([
      fetch(`/api/entities?world_id=${worldId}`).then((x) => x.json()),
      fetch(`/api/scenes/list?world_id=${worldId}`).then((x) => x.json()),
      fetch(`/api/cost/summary?world_id=${worldId}`).then((x) => x.json()),
    ]);
    if (e.ok) setEntities(e.data);
    if (s.ok) setScenes(s.data);
    if (c.ok) setCosts(c.data);
  }, [worldId]);

  useEffect(() => { void loadWorlds(); void loadProfiles(); }, [loadWorlds, loadProfiles]);
  useEffect(() => { void loadWorldData(); }, [loadWorldData]);

  // --- Stream hook (SSE-driven, no polling) ---
  const { rounds, actions, activeRun, events, refresh } = useSimulationStream({
    worldId,
    sceneId: activeSceneId,
  });

  // --- Derived ---
  const characterEntities = useMemo(
    () => entities.filter((e) => e.entityType === 'character'),
    [entities],
  );
  const entityMap = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const activeScene = scenes.find((s) => s.id === activeSceneId);

  // --- Actions ---
  async function createScene(e: React.FormEvent) {
    e.preventDefault();
    const world = worlds.find((w) => w.id === worldId);
    if (!world?.defaultWorldlineId) { alert('世界没有 default_worldline'); return; }
    const res = await fetch('/api/scenes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worldId, worldlineId: world.defaultWorldlineId,
        title: sceneTitle || undefined,
        participantEntityIds: participantsForm,
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setSceneTitle(''); setParticipantsForm([]);
      await loadWorldData();
      setActiveSceneId(json.data.id);
    } else { alert(json.error?.message ?? '创建失败'); }
  }

  // ESC → 退出沉浸
  useEffect(() => {
    if (!immersive) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setImmersive(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [immersive]);

  const showTopbar = !immersive && topbarOpen;
  const showSidebar = !immersive && sidebarOpen;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-black">
      {/* --- 顶栏 --- */}
      {showTopbar && (
        <header className="sticky top-0 z-30 backdrop-blur bg-white/70 dark:bg-zinc-950/70 border-b border-zinc-200 dark:border-zinc-800">
          <div className="px-4 py-3 flex items-center gap-3">
            <h1 className="text-lg font-semibold tracking-tight">模拟剧场</h1>
            <select
              value={worldId}
              onChange={(e) => setWorldId(e.target.value)}
              className="px-2 py-1 text-sm rounded-md border bg-white/60 dark:bg-zinc-900/60 border-zinc-300 dark:border-zinc-700"
            >
              {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <span className="text-xs text-zinc-500">
              今日成本 ${(costs.today?.cost ?? 0).toFixed(4)}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                className="px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                title="折叠左侧"
              >{sidebarOpen ? '◀ 左栏' : '▶ 左栏'}</button>
              <button
                onClick={() => setDrawerOpen((v) => !v)}
                className="px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >控制台 {drawerOpen ? '▶' : '◀'}</button>
              <button
                onClick={() => { setImmersive(true); setDrawerOpen(false); }}
                className="px-3 py-1 text-xs rounded bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90"
                title="沉浸模式 (Esc 退出)"
              >🎬 沉浸</button>
            </div>
          </div>
        </header>
      )}

      {/* 沉浸模式下保留一个细把手退出 */}
      {immersive && (
        <button
          onClick={() => setImmersive(false)}
          className="fixed top-2 right-2 z-50 text-xs px-2 py-1 rounded bg-black/40 text-white hover:bg-black/60"
        >Esc 退出</button>
      )}

      <div className="flex">
        {/* --- 左栏 --- */}
        {showSidebar && (
          <aside className="w-72 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-950/40 backdrop-blur p-3 space-y-3 max-h-[calc(100vh-56px)] overflow-auto sticky top-[56px]">
            <form onSubmit={createScene} className="rounded-xl p-3 bg-white/70 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2">
              <h3 className="font-medium text-sm">新建场景</h3>
              <input
                type="text" placeholder="场景标题"
                value={sceneTitle} maxLength={200}
                onChange={(e) => setSceneTitle(e.target.value)}
                className="w-full px-2 py-1.5 text-sm rounded-md border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
              />
              <div className="text-xs text-zinc-500">参与角色</div>
              <div className="space-y-1 max-h-48 overflow-auto">
                {characterEntities.map((e) => {
                  const profile = e.apiProfileId ? profileMap.get(e.apiProfileId) : null;
                  return (
                    <label key={e.id} className="flex items-center gap-2 text-sm py-0.5">
                      <input
                        type="checkbox"
                        checked={participantsForm.includes(e.id)}
                        onChange={(ev) => {
                          if (ev.target.checked) setParticipantsForm([...participantsForm, e.id]);
                          else setParticipantsForm(participantsForm.filter((x) => x !== e.id));
                        }}
                      />
                      <span>{e.name}</span>
                      {profile && <span className="ml-auto text-[10px] text-zinc-500 truncate max-w-[100px]" title={profile.model}>{profile.model.split('/').pop()}</span>}
                    </label>
                  );
                })}
              </div>
              <button
                type="submit" disabled={participantsForm.length === 0}
                className="w-full py-1.5 text-sm rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 disabled:opacity-40"
              >创建场景</button>
            </form>

            <div className="rounded-xl p-3 bg-white/70 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
              <h3 className="font-medium text-sm mb-2">已有场景</h3>
              {scenes.length === 0 ? (
                <p className="text-xs text-zinc-500">暂无</p>
              ) : (
                <ul className="space-y-1">
                  {scenes.map((s) => (
                    <li
                      key={s.id}
                      className={`px-2 py-1.5 text-sm rounded-md cursor-pointer transition ${
                        activeSceneId === s.id
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                      onClick={() => setActiveSceneId(s.id)}
                    >
                      <div className="truncate">{s.title || '(无标题)'}</div>
                      <div className="text-[10px] opacity-60">{s.status}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        )}

        {/* --- 主区 --- */}
        <main className="flex-1 min-w-0">
          {!activeSceneId ? (
            <div className="flex items-center justify-center h-[80vh] text-zinc-400">
              ← 从左侧选择或新建一个场景
            </div>
          ) : (
            <>
              {/* Tab 切换 + 场景头 */}
              <div className={`px-4 ${immersive ? 'pt-3' : 'pt-4'} pb-2 flex items-center gap-3`}>
                <h2 className="text-base font-medium">{activeScene?.title || '未命名场景'}</h2>
                <span className="text-xs text-zinc-500">{rounds.length} 轮 · {actions.length} 个 action</span>
                <div className="ml-auto flex items-center gap-1 rounded-lg p-0.5 bg-zinc-200/60 dark:bg-zinc-800/60">
                  <button
                    onClick={() => setTab('chat')}
                    className={`px-3 py-1 text-xs rounded-md transition ${tab === 'chat' ? 'bg-white dark:bg-zinc-900 shadow-sm' : 'hover:bg-white/40 dark:hover:bg-zinc-700/40'}`}
                  >💬 群聊视图</button>
                  <button
                    onClick={() => setTab('timeline')}
                    className={`px-3 py-1 text-xs rounded-md transition ${tab === 'timeline' ? 'bg-white dark:bg-zinc-900 shadow-sm' : 'hover:bg-white/40 dark:hover:bg-zinc-700/40'}`}
                  >🎞 时间轴</button>
                </div>
                <select
                  value={perspective}
                  onChange={(e) => setPerspective(e.target.value)}
                  className="px-2 py-1 text-xs rounded-md border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                >
                  <option value="author">上帝视角</option>
                  {characterEntities.map((e) => <option key={e.id} value={e.id}>{e.name} 视角</option>)}
                </select>
              </div>

              <div className="px-4 pb-8">
                {tab === 'chat' ? (
                  <ChatView
                    rounds={rounds}
                    actions={actions}
                    entityMap={entityMap}
                    profileMap={profileMap}
                    perspective={perspective}
                  />
                ) : (
                  <TimelineView
                    rounds={rounds}
                    actions={actions}
                    entityMap={entityMap}
                    profileMap={profileMap}
                  />
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* --- 控制台抽屉（右侧滑出） --- */}
      <ControlPanel
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sceneId={activeSceneId}
        activeRun={activeRun}
        onAfterAction={refresh}
      />

      {/* --- 实时事件浮窗（左下角，沉浸模式下也保留小气泡） --- */}
      <EventDrawer events={events} immersive={immersive} />
    </div>
  );
}
