'use client';

import { useMemo, useEffect, useRef } from 'react';
import type { Round, Action, Entity, ApiProfile } from '../_lib/types';

interface Props {
  rounds: Round[];
  actions: Action[];
  entityMap: Map<string, Entity>;
  profileMap: Map<string, ApiProfile>;
  perspective: 'author' | string;
}

// 角色色卡（按名字稳定 hash → 给气泡分配冷暖色）
function pickColor(name: string): string {
  const palette = [
    'from-rose-100 to-rose-50 dark:from-rose-900/30 dark:to-rose-900/10 border-rose-200 dark:border-rose-800',
    'from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-900/10 border-amber-200 dark:border-amber-800',
    'from-sky-100 to-sky-50 dark:from-sky-900/30 dark:to-sky-900/10 border-sky-200 dark:border-sky-800',
    'from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-900/10 border-emerald-200 dark:border-emerald-800',
    'from-violet-100 to-violet-50 dark:from-violet-900/30 dark:to-violet-900/10 border-violet-200 dark:border-violet-800',
    'from-pink-100 to-pink-50 dark:from-pink-900/30 dark:to-pink-900/10 border-pink-200 dark:border-pink-800',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffffff;
  return palette[h % palette.length];
}

function avatarText(name: string): string {
  return name.slice(-2);
}

// 从 publicLayer / privateLayer 抽出可读文本
function extractPublic(action: Action): { visible?: string; speech?: string; clues?: string[] } {
  const p = action.publicLayer || {};
  return {
    visible: (p['visible_action'] as string) || (p['action'] as string) || undefined,
    speech: (p['speech'] as string) || (p['utterance'] as string) || undefined,
    clues: Array.isArray(p['observable_clues']) ? (p['observable_clues'] as string[]) : undefined,
  };
}
function extractPrivate(action: Action): { thought?: string; intent?: string } {
  const p = action.privateLayer || {};
  return {
    thought: (p['inner_thought'] as string) || (p['thought'] as string) || (p['monologue'] as string) || undefined,
    intent: (p['intent'] as string) || (p['plan'] as string) || undefined,
  };
}

export default function ChatView({ rounds, actions, entityMap, profileMap, perspective }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, Action[]>();
    for (const r of rounds) map.set(r.id, []);
    for (const a of actions) {
      if (!map.has(a.roundId)) map.set(a.roundId, []);
      map.get(a.roundId)!.push(a);
    }
    return map;
  }, [rounds, actions]);

  const bottomRef = useRef<HTMLDivElement>(null);
  // 新动作出现时滚到底
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [actions.length]);

  if (rounds.length === 0) {
    return <div className="text-zinc-400 text-sm py-12 text-center">暂无内容，启动模拟看角色登场 →</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {rounds.map((round, idx) => {
        const acts = grouped.get(round.id) ?? [];
        return (
          <section key={round.id} className="space-y-3">
            <div className="flex items-center gap-3 text-xs text-zinc-400 font-medium">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 dark:via-zinc-700 to-transparent" />
              <span>第 {idx + 1} 幕 · {round.mode === 'simultaneous' ? '同时行动' : '两段式'} · {round.status}</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 dark:via-zinc-700 to-transparent" />
            </div>

            {acts.length === 0 ? (
              <div className="text-center text-xs text-zinc-400 italic py-2">…正在登场</div>
            ) : (
              <ul className="space-y-3">
                {acts.map((a, i) => {
                  const ent = entityMap.get(a.entityId);
                  const isWorld = ent?.entityType === 'world_agent';
                  const profile = ent?.apiProfileId ? profileMap.get(ent.apiProfileId) : null;
                  const modelLabel = profile ? profile.model.split('/').pop() : '';
                  const pub = extractPublic(a);
                  const priv = extractPrivate(a);
                  const showPriv = perspective === 'author' || perspective === a.entityId;

                  if (isWorld) {
                    // 世界规则 → 居中旁白
                    return (
                      <li key={a.id} className="flex justify-center">
                        <div className="max-w-xl text-center text-xs text-zinc-500 dark:text-zinc-400 italic px-4 py-2 rounded-full bg-zinc-100/60 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60">
                          <span className="font-semibold not-italic mr-1">▸ {ent?.name}：</span>
                          {pub.visible || pub.speech || (pub.clues && pub.clues.join('；')) || '(沉默推进)'}
                          {modelLabel && <span className="ml-2 text-[10px] opacity-60 not-italic">／{modelLabel}</span>}
                        </div>
                      </li>
                    );
                  }

                  // 角色 → 气泡左右交错（按名字 hash）
                  const isLeft = (a.entityId.charCodeAt(0) + i) % 2 === 0;
                  const colorCls = pickColor(ent?.name ?? '?');

                  return (
                    <li key={a.id} className={`flex gap-3 ${isLeft ? '' : 'flex-row-reverse'} animate-[fadeIn_300ms_ease-out]`}>
                      {/* 头像 */}
                      <div className={`shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${colorCls} flex items-center justify-center text-sm font-semibold border`}>
                        {avatarText(ent?.name ?? '?')}
                      </div>
                      {/* 内容 */}
                      <div className={`flex-1 max-w-[80%] ${isLeft ? '' : 'text-right'}`}>
                        <div className={`flex items-baseline gap-2 mb-1 text-xs ${isLeft ? '' : 'flex-row-reverse'}`}>
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">{ent?.name ?? '?'}</span>
                          {modelLabel && <span className="text-[10px] text-zinc-400">{modelLabel}</span>}
                          {a.isFallback && <span className="text-[10px] text-amber-600">fallback</span>}
                        </div>
                        <div className={`inline-block rounded-2xl px-4 py-2.5 bg-gradient-to-br ${colorCls} border text-sm leading-relaxed`}>
                          {pub.visible && <div>{pub.visible}</div>}
                          {pub.speech && <div className="mt-1">「{pub.speech}」</div>}
                          {pub.clues && pub.clues.length > 0 && (
                            <ul className="text-xs opacity-75 mt-1 space-y-0.5">
                              {pub.clues.map((c, j) => <li key={j}>· {c}</li>)}
                            </ul>
                          )}
                          {!pub.visible && !pub.speech && (!pub.clues || pub.clues.length === 0) && (
                            <span className="text-zinc-400 italic text-xs">(无外显行为)</span>
                          )}
                        </div>
                        {showPriv && (priv.thought || priv.intent) && (
                          <div className={`mt-1 text-xs text-zinc-500 dark:text-zinc-400 italic ${isLeft ? '' : 'text-right'}`}>
                            💭 {priv.thought || priv.intent}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      <div ref={bottomRef} />

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
