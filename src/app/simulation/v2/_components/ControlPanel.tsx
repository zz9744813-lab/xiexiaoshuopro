'use client';

import { useEffect, useState } from 'react';
import type { SimulationRun } from '../_lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  sceneId: string;
  activeRun: SimulationRun | null;
  onAfterAction: () => void;
}

export default function ControlPanel({ open, onClose, sceneId, activeRun, onAfterAction }: Props) {
  const [runMode, setRunMode] = useState<'simultaneous' | 'hybrid_two_phase'>('simultaneous');
  const [maxRounds, setMaxRounds] = useState('5');
  const [maxCost, setMaxCost] = useState('3');
  const [delayMs, setDelayMs] = useState('0');
  const [stagnation, setStagnation] = useState('');
  const [busy, setBusy] = useState(false);

  const runStatus = activeRun?.status;
  const isLive = runStatus && ['starting', 'running', 'paused', 'stopping'].includes(runStatus);

  async function startRun() {
    if (!sceneId) return;
    setBusy(true);
    try {
      const res = await fetch('/api/simulation/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneId, mode: runMode,
          maxRounds: maxRounds ? Number(maxRounds) : undefined,
          maxCostUsd: maxCost ? Number(maxCost) : undefined,
          roundDelayMs: Number(delayMs) || 0,
          stagnationThreshold: stagnation ? Number(stagnation) : undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) alert(json.error?.message ?? '启动失败');
      onAfterAction();
    } finally { setBusy(false); }
  }

  async function stopRun() {
    if (!activeRun) return;
    setBusy(true);
    try {
      await fetch('/api/simulation/stop', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: activeRun.id }),
      });
      onAfterAction();
    } finally { setBusy(false); }
  }

  async function runOneRound() {
    if (!sceneId) return;
    setBusy(true);
    try {
      await fetch('/api/simulation/run-round', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneId, mode: runMode }),
      });
      onAfterAction();
    } finally { setBusy(false); }
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />}
      <aside
        className="fixed top-0 z-50 h-full w-[360px] bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-xl transition-[right] duration-300"
        style={{ right: open ? 0 : -360, visibility: open ? 'visible' : 'hidden' }}
        aria-hidden={!open}
      >
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center">
          <h3 className="font-medium">控制台</h3>
          <button onClick={onClose} className="ml-auto text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">✕</button>
        </div>
        <div className="p-4 space-y-4 overflow-auto h-[calc(100%-56px)]">
          {!sceneId && <p className="text-sm text-zinc-500">请先在左栏选择/创建场景</p>}

          {sceneId && (
            <>
              {/* 当前 run 状态 */}
              {activeRun && (
                <div className={`rounded-xl p-3 border text-xs ${
                  runStatus === 'running' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' :
                  runStatus === 'failed' ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' :
                  'bg-zinc-50 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800'
                }`}>
                  <div className="font-medium mb-1">状态：{runStatus}</div>
                  <div>已跑 {activeRun.totalRounds} / {activeRun.maxRounds ?? '∞'} 轮</div>
                  <div>成本 ${Number(activeRun.totalCostUsd).toFixed(4)} / ${activeRun.maxCostUsd ?? '∞'}</div>
                  {activeRun.stopReason && <div>原因：{activeRun.stopReason}</div>}
                  {activeRun.errorMessage && <div className="mt-1 text-red-600 dark:text-red-400 break-all">{activeRun.errorMessage}</div>}
                </div>
              )}

              {/* 模式 */}
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">模式</label>
                <select value={runMode} onChange={(e) => setRunMode(e.target.value as typeof runMode)}
                  className="w-full px-2 py-1.5 text-sm rounded-md border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700">
                  <option value="simultaneous">同步并行</option>
                  <option value="hybrid_two_phase">混合两段式</option>
                </select>
              </div>

              {/* 单轮按钮 */}
              <button
                onClick={runOneRound} disabled={busy || isLive}
                className="w-full py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
              >▷ 跑单轮</button>

              {/* 连续模拟参数 */}
              <fieldset className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 space-y-2">
                <legend className="px-1 text-xs text-zinc-500">连续模拟</legend>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label>最大轮数<input type="number" value={maxRounds} onChange={(e) => setMaxRounds(e.target.value)} className="w-full mt-0.5 px-2 py-1 rounded border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700" /></label>
                  <label>上限 $<input type="number" step="0.1" value={maxCost} onChange={(e) => setMaxCost(e.target.value)} className="w-full mt-0.5 px-2 py-1 rounded border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700" /></label>
                  <label>间隔 ms<input type="number" value={delayMs} onChange={(e) => setDelayMs(e.target.value)} className="w-full mt-0.5 px-2 py-1 rounded border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700" /></label>
                  <label>停滞阈值<input type="number" value={stagnation} onChange={(e) => setStagnation(e.target.value)} className="w-full mt-0.5 px-2 py-1 rounded border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700" /></label>
                </div>
                {!isLive ? (
                  <button onClick={startRun} disabled={busy}
                    className="w-full py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40">▶ 启动连续模拟</button>
                ) : (
                  <button onClick={stopRun} disabled={busy}
                    className="w-full py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-40">■ 终止</button>
                )}
              </fieldset>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
