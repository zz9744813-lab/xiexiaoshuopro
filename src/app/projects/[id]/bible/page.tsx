"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface CanonFact {
  id: string;
  fact: string;
  category: string | null;
  immutable: boolean;
  createdAt: string;
}

interface WorldEntry {
  id: string;
  kind: string;
  name: string;
  description: string | null;
  rules: string | null;
  parentId: string | null;
  appearanceCount: number;
}

type Tab = "canon" | "world";

const WORLD_KINDS = [
  { id: "location", label: "地点" },
  { id: "item", label: "物品" },
  { id: "concept", label: "概念" },
  { id: "magic", label: "法术/功法" },
  { id: "faction", label: "势力" },
  { id: "rule", label: "规则" },
];

export default function BiblePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [projectId, setProjectId] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("canon");
  const [canonFacts, setCanonFacts] = useState<CanonFact[]>([]);
  const [worldEntries, setWorldEntries] = useState<WorldEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Canon form
  const [newFact, setNewFact] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newImmutable, setNewImmutable] = useState(false);

  // World entry form
  const [newKind, setNewKind] = useState("location");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newRules, setNewRules] = useState("");

  useEffect(() => {
    params.then(({ id }) => {
      setProjectId(id);
      fetchBible(id);
    });
  }, [params]);

  async function fetchBible(id: string) {
    try {
      const res = await fetch(`/api/projects/${id}/bible`);
      const data = await res.json();
      setCanonFacts(data.canonFacts || []);
      setWorldEntries(data.worldEntries || []);
    } catch (err) {
      console.error("获取世界观失败:", err);
    } finally {
      setLoading(false);
    }
  }

  async function addCanonFact(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`/api/projects/${projectId}/bible`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "canon", fact: newFact, category: newCategory, immutable: newImmutable }),
      });
      const data = await res.json();
      if (data.id) {
        setCanonFacts((prev) => [...prev, data]);
        setNewFact("");
        setNewCategory("");
        setNewImmutable(false);
        setShowForm(false);
      }
    } catch (err) {
      console.error("添加失败:", err);
    }
  }

  async function addWorldEntry(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`/api/projects/${projectId}/bible`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "world", kind: newKind, name: newName, description: newDescription, rules: newRules }),
      });
      const data = await res.json();
      if (data.id) {
        setWorldEntries((prev) => [...prev, data]);
        setNewName("");
        setNewDescription("");
        setNewRules("");
        setShowForm(false);
      }
    } catch (err) {
      console.error("添加失败:", err);
    }
  }

  const kindLabels: Record<string, string> = {
    location: "地点", item: "物品", concept: "概念",
    magic: "法术", faction: "势力", rule: "规则",
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/projects/${projectId}`} className="text-gray-500 hover:text-gray-700 text-sm">
              ← 项目
            </Link>
            <h1 className="text-xl font-bold">世界观 Bible</h1>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            添加条目
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setActiveTab("canon")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "canon" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500"
            }`}
          >
            硬性事实 ({canonFacts.length})
          </button>
          <button
            onClick={() => setActiveTab("world")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "world" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500"
            }`}
          >
            世界条目 ({worldEntries.length})
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400">加载中...</p>
        ) : activeTab === "canon" ? (
          <div className="space-y-3">
            {canonFacts.length === 0 ? (
              <p className="text-center py-12 text-gray-400">暂无硬性事实</p>
            ) : (
              canonFacts.map((f) => (
                <div key={f.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    {f.immutable && (
                      <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded">
                        不可变
                      </span>
                    )}
                    {f.category && (
                      <span className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                        {f.category}
                      </span>
                    )}
                  </div>
                  <p className="text-sm">{f.fact}</p>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {worldEntries.length === 0 ? (
              <p className="col-span-full text-center py-12 text-gray-400">暂无世界条目</p>
            ) : (
              worldEntries.map((e) => (
                <div key={e.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                      {kindLabels[e.kind] || e.kind}
                    </span>
                  </div>
                  <h3 className="font-semibold">{e.name}</h3>
                  {e.description && <p className="text-sm text-gray-500 mt-1 line-clamp-3">{e.description}</p>}
                  {e.rules && <p className="text-xs text-purple-500 mt-2">规则：{e.rules}</p>}
                </div>
              ))
            )}
          </div>
        )}

        {/* 添加表单 Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-lg">
              <h2 className="text-lg font-semibold mb-4">
                添加{activeTab === "canon" ? "硬性事实" : "世界条目"}
              </h2>

              {activeTab === "canon" ? (
                <form onSubmit={addCanonFact} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">事实内容</label>
                    <textarea
                      value={newFact}
                      onChange={(e) => setNewFact(e.target.value)}
                      placeholder="如：主角出生于元和元年"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 outline-none resize-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">分类</label>
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="如：时间线、人物、地理"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 outline-none"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={newImmutable}
                      onChange={(e) => setNewImmutable(e.target.checked)}
                    />
                    不可变（永远不能被后续章节推翻）
                  </label>
                  <div className="flex gap-3">
                    <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      添加
                    </button>
                    <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg">
                      取消
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={addWorldEntry} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">类型</label>
                    <select
                      value={newKind}
                      onChange={(e) => setNewKind(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 outline-none"
                    >
                      {WORLD_KINDS.map((k) => (
                        <option key={k.id} value={k.id}>{k.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">名称</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">描述</label>
                    <textarea
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">规则/约束</label>
                    <textarea
                      value={newRules}
                      onChange={(e) => setNewRules(e.target.value)}
                      rows={2}
                      placeholder="如：只有金丹期以上才能进入"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 outline-none resize-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      添加
                    </button>
                    <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg">
                      取消
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
