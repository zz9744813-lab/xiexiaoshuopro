'use client';

import { useEffect, useState } from 'react';

interface World {
  id: string;
  name: string;
  defaultWorldlineId?: string | null;
}

interface CostSummary {
  today?: { cost: number; tokenInput: number; tokenOutput: number };
  scene?: { cost: number } | null;
  round?: { cost: number } | null;
}

export default function CostPage() {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [worldId, setWorldId] = useState('');
  const [summary, setSummary] = useState<CostSummary>({});

  async function loadWorlds() {
    const r = await fetch('/api/worlds').then((x) => x.json());
    if (r.ok) {
      setWorlds(r.data);
      if (r.data.length && !worldId) setWorldId(r.data[0].id);
    }
  }
  async function loadSummary() {
    if (!worldId) return;
    const r = await fetch(`/api/cost/summary?world_id=${worldId}`).then((x) => x.json());
    if (r.ok) setSummary(r.data);
  }

  useEffect(() => {
    void loadWorlds();
  }, []);
  useEffect(() => {
    void loadSummary();
    const t = setInterval(() => void loadSummary(), 5000);
    return () => clearInterval(t);
  }, [worldId]);

  const today = summary.today ?? { cost: 0, tokenInput: 0, tokenOutput: 0 };

  return (
    <main className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold">成本仪表盘</h1>
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
          <span className="ml-auto text-xs text-zinc-500">5 秒自动刷新</span>
        </div>

        <p className="text-sm text-zinc-500 mb-6">
          每次 LLM 调用产生 cost_logs；超出 per_run / per_day 时引擎自动按
          api_profile.fallback_api_profile_id 切换或暂停。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card label="今日累计成本" value={`$${today.cost.toFixed(4)}`} highlight />
          <Card label="今日输入 tokens" value={today.tokenInput.toLocaleString()} />
          <Card label="今日输出 tokens" value={today.tokenOutput.toLocaleString()} />
        </div>

        <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-300 dark:border-yellow-800 rounded">
          <h3 className="font-medium mb-2">熔断行为</h3>
          <ul className="text-sm space-y-1 list-disc list-inside text-zinc-600 dark:text-zinc-400">
            <li>per_call / per_run / per_day 超限触发 cost.budget.exceeded 事件</li>
            <li>主角 / 主世界默认 onExceed=pause（抛 BudgetExceededError，round 标 paused）</li>
            <li>重要配角默认 onExceed=fallback（切换到 fallback_api_profile_id）</li>
            <li>普通 NPC 默认 onExceed=degrade（缩短上下文继续）</li>
            <li>到达 80% 触发 cost.budget.warning 事件</li>
          </ul>
        </div>
      </div>
    </main>
  );
}

function Card({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`p-4 rounded border ${
        highlight
          ? 'bg-zinc-900 text-white border-zinc-900'
          : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800'
      }`}
    >
      <div className={`text-xs ${highlight ? 'text-zinc-300' : 'text-zinc-500'}`}>
        {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
