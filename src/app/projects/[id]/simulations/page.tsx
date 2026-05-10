"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Simulation {
  id: string;
  status: string;
  directorGoal: string;
  charactersInvolved: Array<{ id: string; name: string }>;
  createdAt: string;
}

export default function SimulationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [projectId, setProjectId] = useState("");
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [directorGoal, setDirectorGoal] = useState("");
  const [characterNames, setCharacterNames] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    params.then(({ id }) => {
      setProjectId(id);
      fetchSimulations(id);
    });
  }, [params]);

  async function fetchSimulations(id: string) {
    try {
      const res = await fetch(`/api/simulations?projectId=${id}`);
      const data = await res.json();
      setSimulations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("获取推演列表失败:", err);
    }
  }

  async function startSimulation() {
    if (!directorGoal) return;
    setIsRunning(true);
    setStreamContent("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          characterIds: [], // TODO: 从角色列表选择
          directorGoal,
          maxTurns: 20,
        }),
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setStreamContent(fullText);
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("推演错误:", err);
      }
    } finally {
      setIsRunning(false);
    }
  }

  function stopSimulation() {
    abortRef.current?.abort();
    setIsRunning(false);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/projects/${projectId}`} className="text-gray-500 hover:text-gray-700 text-sm">
              ← 项目
            </Link>
            <h1 className="text-xl font-bold">多 Agent 推演</h1>
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            新建推演
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-6">
        {/* 新建推演表单 */}
        {showNewForm && (
          <div className="mb-8 p-6 border border-blue-200 dark:border-blue-800 rounded-xl bg-blue-50 dark:bg-blue-950">
            <h2 className="text-lg font-semibold mb-4">新建推演</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">场景目标</label>
                <textarea
                  value={directorGoal}
                  onChange={(e) => setDirectorGoal(e.target.value)}
                  placeholder="描述这场推演要达成什么目标，如：李某与王某在酒楼相遇，试探对方底细..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">参与角色（逗号分隔）</label>
                <input
                  type="text"
                  value={characterNames}
                  onChange={(e) => setCharacterNames(e.target.value)}
                  placeholder="李某, 王某, 张某"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={startSimulation}
                  disabled={isRunning || !directorGoal}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isRunning ? "推演中..." : "开始推演"}
                </button>
                {isRunning && (
                  <button
                    onClick={stopSimulation}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    停止
                  </button>
                )}
                <button
                  onClick={() => setShowNewForm(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 推演流式输出 */}
        {streamContent && (
          <div className="mb-8 p-6 border border-gray-200 dark:border-gray-700 rounded-xl">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              推演实况
              {isRunning && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
            </h3>
            <div className="whitespace-pre-wrap text-sm leading-relaxed font-serif max-h-96 overflow-y-auto">
              {streamContent}
            </div>
          </div>
        )}

        {/* 历史推演列表 */}
        <h2 className="text-lg font-semibold mb-4">推演历史</h2>
        {simulations.length === 0 ? (
          <div className="text-center py-12 text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
            <p>暂无推演记录</p>
            <p className="text-sm mt-2">点击"新建推演"开始多 Agent 角色扮演</p>
          </div>
        ) : (
          <div className="space-y-3">
            {simulations.map((sim) => (
              <div
                key={sim.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    sim.status === "done" ? "bg-green-100 text-green-700" :
                    sim.status === "running" ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {sim.status}
                  </span>
                  <span className="text-xs text-gray-400">{sim.createdAt}</span>
                </div>
                <p className="text-sm font-medium">{sim.directorGoal}</p>
                {sim.charactersInvolved && (
                  <p className="text-xs text-gray-500 mt-1">
                    参与：{sim.charactersInvolved.map((c) => c.name).join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
