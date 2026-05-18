'use client';

import { useState } from 'react';
import type { SimEvent } from '../_lib/types';

interface Props {
  events: SimEvent[];
  immersive: boolean;
}

const colorOf = (type: string): string => {
  if (type.startsWith('round.committed')) return 'text-emerald-600 dark:text-emerald-400';
  if (type.startsWith('round.rolled_back') || type.includes('failed') || type.includes('error')) return 'text-red-600 dark:text-red-400';
  if (type.startsWith('character.')) return 'text-sky-600 dark:text-sky-400';
  if (type.startsWith('world.')) return 'text-violet-600 dark:text-violet-400';
  if (type.startsWith('cost.')) return 'text-amber-600 dark:text-amber-400';
  return 'text-zinc-500';
};

export default function EventDrawer({ events, immersive }: Props) {
  const [open, setOpen] = useState(false);
  const recent = events.slice(0, 20);
  const latest = events[0];

  return (
    <div className="fixed bottom-3 left-3 z-30">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs backdrop-blur shadow-md ${immersive ? 'bg-black/40 text-white hover:bg-black/60' : 'bg-white/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-900'}`}
          title="实时事件"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium">SSE</span>
          {latest && <span className={`max-w-[200px] truncate ${colorOf(latest.type)}`}>{latest.type}</span>}
          <span className="text-zinc-400">{events.length}</span>
        </button>
      ) : (
        <div className="w-[340px] max-h-[60vh] rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-xl flex flex-col">
          <div className="flex items-center px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-medium">实时事件 · SSE</span>
            <span className="ml-2 text-[10px] text-zinc-400">{events.length}</span>
            <button onClick={() => setOpen(false)} className="ml-auto text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white">✕</button>
          </div>
          <ul className="flex-1 overflow-auto text-[11px] divide-y divide-zinc-100 dark:divide-zinc-900">
            {recent.length === 0 ? (
              <li className="p-3 text-zinc-400">暂无事件…</li>
            ) : recent.map((ev) => (
              <li key={ev.id} className="px-3 py-1.5 flex items-center gap-2">
                <span className={`font-mono ${colorOf(ev.type)}`}>{ev.type}</span>
                <span className="ml-auto text-zinc-400">{new Date(ev.ts).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
