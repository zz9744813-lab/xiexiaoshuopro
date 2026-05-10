"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Prompt {
  id: string;
  name: string;
  version: number;
  scope: string;
  active: boolean;
  notes: string | null;
  createdAt: string;
}

export default function PromptsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [projectId, setProjectId] = useState("");
  const [prompts, setPrompts] = useState<Prompt[]>([]);

  useEffect(() => {
    params.then(({ id }) => setProjectId(id));
  }, [params]);

  // 从文件系统读取的 prompt 列表（静态展示）
  const builtinPrompts = [
    { name: "chapter-draft", scope: "agent", description: "章节初稿生成" },
    { name: "chapter-summary", scope: "agent", description: "章节摘要" },
    { name: "premise", scope: "agent", description: "命题生成" },
    { name: "volume-outline", scope: "agent", description: "卷大纲" },
    { name: "chapter-outline", scope: "agent", description: "章节细纲" },
    { name: "bible-extract", scope: "agent", description: "Bible 抽取" },
    { name: "hook", scope: "agent", description: "章末钩子" },
    { name: "section-rewriter", scope: "agent", description: "段落重写" },
    { name: "director", scope: "agent", description: "推演导演" },
    { name: "narrator", scope: "agent", description: "叙述化" },
    { name: "logic-reviewer", scope: "reviewer", description: "逻辑审查" },
    { name: "voice-reviewer", scope: "reviewer", description: "声音审查" },
    { name: "canon-reviewer", scope: "reviewer", description: "设定审查" },
    { name: "pacing-reviewer", scope: "reviewer", description: "节奏审查" },
    { name: "theme-reviewer", scope: "reviewer", description: "主题审查" },
    { name: "genre-reviewer", scope: "reviewer", description: "类型审查" },
    { name: "reader-simulator", scope: "reviewer", description: "读者模拟" },
    { name: "slop-reviewer", scope: "reviewer", description: "AI味检测" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href={`/projects/${projectId}`} className="text-gray-500 hover:text-gray-700 text-sm">
            ← 项目
          </Link>
          <h1 className="text-xl font-bold">Prompt 管理</h1>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-6">
        <p className="text-sm text-gray-500 mb-6">
          所有 Agent 的 prompt 模板。修改 prompt 会影响后续生成质量。
        </p>

        <div className="space-y-2">
          {builtinPrompts.map((p) => (
            <div
              key={p.name}
              className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 text-xs rounded ${
                  p.scope === "agent"
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                    : "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300"
                }`}>
                  {p.scope}
                </span>
                <div>
                  <span className="font-medium text-sm">{p.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{p.description}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">v1</span>
                <span className="w-2 h-2 bg-green-500 rounded-full" title="active" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
