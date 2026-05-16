'use client';

import { useEffect, useState } from 'react';

interface World {
  id: string;
  name: string;
  defaultWorldlineId?: string | null;
}

interface Scene {
  id: string;
  title?: string | null;
}

interface DriftReport {
  entityId: string;
  entityName: string;
  level: 'normal' | 'monitor' | 'warning' | 'severe';
  score: number;
  forbiddenPhraseHits: string[];
  recentSpeechSamples: string[];
  reasons: string[];
}

interface StagnationReport {
  sceneId: string;
  consecutiveStagnantRounds: number;
  level: 'none' | 'mild' | 'moderate' | 'severe';
  reasons: string[];
  suggestedRemedy: string | null;
}

interface SceneEval {
  sceneId: string;
  privacyScore: number;
  consistencyScore: number;
  causalityScore: number;
  agencyScore: number;
  dramaScore: number;
  noveltyScore: number;
  stagnationScore: number;
  costScore: number;
  warnings: string[];
}

const DRIFT_COLORS: Record<string, string> = {
  normal: 'text-green-600',
  monitor: 'text-blue-600',
  warning: 'text-yellow-600',
  severe: 'text-red-600',
};

const STAG_COLORS: Record<string, string> = {
  none: 'text-green-600',
  mild: 'text-blue-600',
  moderate: 'text-yellow-600',
  severe: 'text-red-600',
};

export default function QualityPage() {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [worldId, setWorldId] = useState('');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sceneId, setSceneId] = useState('');
  const [drift, setDrift] = useState<DriftReport[]>([]);
  const [stag, setStag] = useState<StagnationReport | null>(null);
  const [evalRes, setEvalRes] = useState<SceneEval | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadWorlds() {
    const r = await fetch('/api/worlds').then((x) => x.json());
    if (r.ok) {
      setWorlds(r.data);
      if (r.data.length && !worldId) setWorldId(r.data[0].id);
    }
  }
  async function loadScenes() {
    if (!worldId) return;
    const r = await fetch(`/api/scenes/list?world_id=${worldId}`).then((x) => x.json());
    if (r.ok) {
      setScenes(r.data);
      if (r.data.length && !sceneId) setSceneId(r.data[0].id);
    }
  }
  useEffect(() => {
    void loadWorlds();
  }, []);
  useEffect(() => {
    void loadScenes();
  }, [worldId]);

  async function checkDrift() {
    const w = worlds.find((x) => x.id === worldId);
    if (!w?.defaultWorldlineId) return;
    setBusy(true);
    const r = await fetch('/api/quality/drift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worldId, worldlineId: w.defaultWorldlineId }),
    }).then((x) => x.json());
    if (r.ok) setDrift(r.data);
    setBusy(false);
  }

  async function checkStag() {
    if (!sceneId) return;
    setBusy(true);
    const r = await fetch('/api/quality/stagnation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneId }),
    }).then((x) => x.json());
    if (r.ok) setStag(r.data);
    setBusy(false);
  }

  async function checkEval() {
    if (!sceneId) return;
    setBusy(true);
    const r = await fetch('/api/quality/eval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneId }),
    }).then((x) => x.json());
    if (r.ok) setEvalRes(r.data);
    setBusy(false);
  }

  return (
    <main className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold">质量检测</h1>
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
            value={sceneId}
            onChange={(e) => setSceneId(e.target.value)}
            className="px-3 py-1 border rounded bg-white dark:bg-zinc-900"
          >
            <option value="">选择场景</option>
            {scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title || s.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>

        {/* Drift */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">角色漂移检测</h2>
            <button
              onClick={checkDrift}
              disabled={busy || !worldId}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              检查所有角色
            </button>
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            score = embedding*0.5 + sentence_pattern*0.2 + forbidden_phrase*0.2 + goal_alignment*0.1
          </p>
          {drift.length === 0 ? (
            <p className="text-sm text-zinc-500">点「检查所有角色」开始</p>
          ) : (
            <ul className="space-y-2">
              {drift.map((d) => (
                <li
                  key={d.entityId}
                  className="p-3 bg-white dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800"
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{d.entityName}</span>
                    <span className={`font-mono text-sm ${DRIFT_COLORS[d.level]}`}>
                      {d.level} ({d.score.toFixed(2)})
                    </span>
                  </div>
                  {d.reasons.length > 0 && (
                    <ul className="mt-1 text-xs text-zinc-500 list-disc list-inside">
                      {d.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                  {d.forbiddenPhraseHits.length > 0 && (
                    <p className="mt-1 text-xs text-red-600">
                      禁忌词命中：{d.forbiddenPhraseHits.join(', ')}
                    </p>
                  )}
                  {d.recentSpeechSamples.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-zinc-500 cursor-pointer">
                        近期台词样本
                      </summary>
                      <ul className="text-xs italic mt-1 ml-4 list-disc">
                        {d.recentSpeechSamples.map((s, i) => (
                          <li key={i}>「{s}」</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Stagnation */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">剧情停滞检测</h2>
            <button
              onClick={checkStag}
              disabled={busy || !sceneId}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              检查当前场景
            </button>
          </div>
          {!stag ? (
            <p className="text-sm text-zinc-500">点「检查当前场景」开始</p>
          ) : (
            <div className="p-4 bg-white dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800">
              <div className="flex justify-between">
                <span className="font-medium">停滞等级</span>
                <span className={`font-mono text-sm ${STAG_COLORS[stag.level]}`}>
                  {stag.level}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                连续停滞轮：{stag.consecutiveStagnantRounds}
              </p>
              {stag.suggestedRemedy && (
                <p className="text-xs text-blue-600 mt-1">
                  建议兜底方式：{stag.suggestedRemedy}
                </p>
              )}
              {stag.reasons.length > 0 && (
                <ul className="mt-2 text-xs text-zinc-500 list-disc list-inside">
                  {stag.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* Eval */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">场景质量 Eval</h2>
            <button
              onClick={checkEval}
              disabled={busy || !sceneId}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              评估当前场景
            </button>
          </div>
          {!evalRes ? (
            <p className="text-sm text-zinc-500">点「评估当前场景」开始</p>
          ) : (
            <div className="p-4 bg-white dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Metric label="隐私" v={evalRes.privacyScore} />
                <Metric label="一致性" v={evalRes.consistencyScore} />
                <Metric label="因果" v={evalRes.causalityScore} />
                <Metric label="自主性" v={evalRes.agencyScore} />
                <Metric label="戏剧" v={evalRes.dramaScore} />
                <Metric label="新颖" v={evalRes.noveltyScore} />
                <Metric label="非停滞" v={evalRes.stagnationScore} />
                <Metric label="成本" v={evalRes.costScore} />
              </div>
              {evalRes.warnings.length > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-1">告警</p>
                  <ul className="text-sm space-y-1">
                    {evalRes.warnings.map((w, i) => (
                      <li key={i} className="text-yellow-700">
                        • {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, v }: { label: string; v: number }) {
  const color = v >= 0.8 ? 'text-green-600' : v >= 0.6 ? 'text-yellow-600' : 'text-red-600';
  return (
    <div className="text-center p-2 bg-zinc-50 dark:bg-zinc-900 rounded">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`text-lg font-bold mt-1 ${color}`}>{(v * 100).toFixed(0)}%</div>
    </div>
  );
}
