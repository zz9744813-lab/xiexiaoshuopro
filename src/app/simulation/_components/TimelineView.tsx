'use client';

import { useMemo, useState } from 'react';
import type { Round, Action, Entity, ApiProfile } from '../_lib/types';

interface Props {
  rounds: Round[];
  actions: Action[];
  entityMap: Map<string, Entity>;
  profileMap: Map<string, ApiProfile>;
}

function statusDot(status: string): string {
  if (status === 'committed') return 'bg-emerald-500';
  if (status === 'running' || status === 'in_progress') return 'bg-blue-500 animate-pulse';
  if (status === 'failed' || status === 'error') return 'bg-red-500';
  if (status === 'rolled_back') return 'bg-amber-500';
  if (status === 'pending') return 'bg-zinc-300 dark:bg-zinc-600';
  return 'bg-zinc-400';
}

export default function TimelineView({ rounds, actions, entityMap, profileMap }: Props) {
  const [openRounds, setOpenRounds] = useState<Set<string>>(new Set(rounds.map((r) => r.id)));

  const grouped = useMemo(() => {
    const map = new Map<string, Action[]>();
    for (const r of rounds) map.set(r.id, []);
    for (const a of actions) {
      if (!map.has(a.roundId)) map.set(a.roundId, []);
      map.get(a.roundId)!.push(a);
    }
    return map;
  }, [rounds, actions]);

  function toggle(id: string) {
    setOpenRounds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (rounds.length === 0) {
    return <div className="text-zinc-400 text-sm py-12 text-center">暂无内容</div>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="relative pl-6">
        {/* 主时间轴 */}
        <div className="absolute left-2 top-2 bottom-2 w-px bg-zinc-300 dark:bg-zinc-700" />
        <ul className="space-y-4">
          {rounds.map((round, idx) => {
            const acts = grouped.get(round.id) ?? [];
            const open = openRounds.has(round.id);
            return (
              <li key={round.id} className="relative">
                {/* 节点 */}
                <span className={`absolute -left-5 top-2 w-3 h-3 rounded-full ${statusDot(round.status)} ring-4 ring-white dark:ring-zinc-950`} />
                <div className="rounded-xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <button
                    onClick={() => toggle(round.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  >
                    <span className="font-medium">第 {idx + 1} 幕</span>
                    <span className="text-xs text-zinc-500">{round.mode === 'simultaneous' ? '同时行动' : '两段式'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      round.status === 'committed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                      round.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                      'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}>{round.status}</span>
                    <span className="ml-auto text-xs text-zinc-500">{acts.length} action</span>
                    <span className="text-zinc-400">{open ? '▾' : '▸'}</span>
                  </button>

                  {open && (
                    <div className="border-t border-zinc-200 dark:border-zinc-800 p-3">
                      {acts.length === 0 ? (
                        <div className="text-xs text-zinc-400 italic">（暂无 action）</div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {acts.map((a) => {
                            const ent = entityMap.get(a.entityId);
                            const profile = ent?.apiProfileId ? profileMap.get(ent.apiProfileId) : null;
                            const modelLabel = profile?.model.split('/').pop() ?? '';
                            const pub = a.publicLayer || {};
                            const priv = a.privateLayer || {};
                            const visible = (pub['visible_action'] as string) || (pub['action'] as string) || '';
                            const thought = (priv['inner_thought'] as string) || (priv['thought'] as string) || '';
                            return (
                              <div key={a.id} className="relative group rounded-lg border border-zinc-200 dark:border-zinc-800 p-2.5 text-xs bg-white dark:bg-zinc-900">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium">{ent?.name ?? '?'}</span>
                                  <span className="text-[10px] text-zinc-400 truncate">{modelLabel}</span>
                                  {a.isFallback && <span className="text-[10px] text-amber-600 ml-auto">fb</span>}
                                </div>
                                <div className="mt-1 text-zinc-700 dark:text-zinc-300 line-clamp-2 leading-snug min-h-[2em]">
                                  {visible || <span className="italic text-zinc-400">(无外显)</span>}
                                </div>
                                {thought && (
                                  <div className="absolute hidden group-hover:block z-20 left-0 top-full mt-1 w-64 p-2 rounded-md bg-zinc-900 text-white text-[11px] leading-relaxed shadow-lg">
                                    💭 {thought}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
