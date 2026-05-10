"use client";

import { useState } from "react";
import Link from "next/link";
import slopDictionary from "../../../../../prompts/slop_dictionaries/chinese_general.json";

interface SlopPattern {
  pattern: string;
  category: string;
  replacement: string;
  is_regex?: boolean;
}

export default function StylePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [projectId, setProjectId] = useState("");
  const [activeTab, setActiveTab] = useState<"voice" | "slop">("voice");
  const [voiceCard, setVoiceCard] = useState("");
  const [customPatterns, setCustomPatterns] = useState<SlopPattern[]>([]);
  const [newPattern, setNewPattern] = useState("");
  const [newCategory, setNewCategory] = useState("cliche");
  const [newReplacement, setNewReplacement] = useState("");

  // 初始化 projectId
  useState(() => {
    params.then(({ id }) => setProjectId(id));
  });

  function addCustomPattern() {
    if (!newPattern) return;
    setCustomPatterns([
      ...customPatterns,
      { pattern: newPattern, category: newCategory, replacement: newReplacement },
    ]);
    setNewPattern("");
    setNewReplacement("");
  }

  const categories = [
    { id: "cliche", label: "陈词滥调" },
    { id: "ai_tell", label: "AI 告知" },
    { id: "over_explain", label: "过度解释" },
    { id: "empty_emotion", label: "空洞情感" },
    { id: "repetition", label: "重复模式" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href={`/projects/${projectId}`} className="text-gray-500 hover:text-gray-700 text-sm">
            ← 项目
          </Link>
          <h1 className="text-xl font-bold">文风管理</h1>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setActiveTab("voice")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "voice" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500"
            }`}
          >
            声音卡
          </button>
          <button
            onClick={() => setActiveTab("slop")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "slop" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500"
            }`}
          >
            AI 味黑名单
          </button>
        </div>

        {activeTab === "voice" ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-2">项目声音卡</h2>
              <p className="text-sm text-gray-500 mb-4">
                描述这部小说的整体叙述风格，AI 生成时会参考这张卡。
              </p>
              <textarea
                value={voiceCard}
                onChange={(e) => setVoiceCard(e.target.value)}
                rows={10}
                placeholder={`示例：
- 叙述风格：冷峻克制，少用形容词
- 句长偏好：短句为主，偶尔长句制造节奏变化
- 对话风格：简洁有力，潜台词丰富
- 禁止：内心独白用"他想"，不用"不禁"
- 参考作者：余华、阿来`}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none resize-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <button className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
                保存声音卡
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-2">AI 味黑名单</h2>
              <p className="text-sm text-gray-500 mb-4">
                以下表达会在生成时被避免，审查时被标记。共 {slopDictionary.patterns.length + customPatterns.length} 条规则。
              </p>
            </div>

            {/* 内置规则 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-3">内置规则 ({slopDictionary.patterns.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {slopDictionary.patterns.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                    <span className="px-1.5 py-0.5 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded">
                      {p.category}
                    </span>
                    <span className="font-mono">{p.pattern}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 自定义规则 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-3">自定义规则 ({customPatterns.length})</h3>
              {customPatterns.length > 0 && (
                <div className="space-y-2 mb-4">
                  {customPatterns.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950 rounded text-sm">
                      <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                        {p.category}
                      </span>
                      <span className="font-mono">{p.pattern}</span>
                      <span className="text-gray-400 ml-auto text-xs">{p.replacement}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 添加新规则 */}
              <div className="p-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                <h4 className="text-sm font-medium mb-3">添加自定义规则</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={newPattern}
                    onChange={(e) => setNewPattern(e.target.value)}
                    placeholder="匹配模式"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 outline-none text-sm"
                  />
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 outline-none text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newReplacement}
                    onChange={(e) => setNewReplacement(e.target.value)}
                    placeholder="替换建议"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 outline-none text-sm"
                  />
                </div>
                <button
                  onClick={addCustomPattern}
                  disabled={!newPattern}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  添加规则
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
