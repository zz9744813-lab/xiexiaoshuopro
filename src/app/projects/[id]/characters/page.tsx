"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Character {
  id: string;
  name: string;
  tier: "principal" | "recurring" | "walk_on";
  appearance: string | null;
  publicRole: string | null;
  secretMotive: string | null;
  arcGoal: string | null;
  alive: boolean;
  appearanceCount: number;
}

export default function CharactersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [projectId, setProjectId] = useState("");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeTab, setActiveTab] = useState<"principal" | "recurring" | "walk_on">("principal");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // 新角色表单
  const [formData, setFormData] = useState({
    name: "",
    tier: "principal" as Character["tier"],
    appearance: "",
    publicRole: "",
    secretMotive: "",
    arcGoal: "",
  });

  useEffect(() => {
    params.then(({ id }) => {
      setProjectId(id);
      fetchCharacters(id);
    });
  }, [params]);

  async function fetchCharacters(id: string) {
    try {
      const res = await fetch(`/api/projects/${id}/characters`);
      const data = await res.json();
      setCharacters(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("获取角色失败:", err);
    } finally {
      setLoading(false);
    }
  }

  async function createCharacter(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`/api/projects/${projectId}/characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.id) {
        setCharacters((prev) => [...prev, data]);
        setShowForm(false);
        setFormData({ name: "", tier: "principal", appearance: "", publicRole: "", secretMotive: "", arcGoal: "" });
      }
    } catch (err) {
      console.error("创建角色失败:", err);
    }
  }

  const filtered = characters.filter((c) => c.tier === activeTab);

  const tierLabels = { principal: "主要角色", recurring: "常驻角色", walk_on: "路人角色" };
  const tierCounts = {
    principal: characters.filter((c) => c.tier === "principal").length,
    recurring: characters.filter((c) => c.tier === "recurring").length,
    walk_on: characters.filter((c) => c.tier === "walk_on").length,
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/projects/${projectId}`} className="text-gray-500 hover:text-gray-700 text-sm">
              ← 项目
            </Link>
            <h1 className="text-xl font-bold">角色管理</h1>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            新建角色
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        {/* Tab 切换 */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800">
          {(["principal", "recurring", "walk_on"] as const).map((tier) => (
            <button
              key={tier}
              onClick={() => setActiveTab(tier)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tier
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tierLabels[tier]} ({tierCounts[tier]})
            </button>
          ))}
        </div>

        {/* 角色列表 */}
        {loading ? (
          <p className="text-gray-400">加载中...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p>暂无{tierLabels[activeTab]}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((char) => (
              <div
                key={char.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg">{char.name}</h3>
                  {!char.alive && (
                    <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">已故</span>
                  )}
                </div>
                {char.publicRole && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{char.publicRole}</p>
                )}
                {char.arcGoal && (
                  <p className="text-xs text-gray-400 mb-2">弧线：{char.arcGoal}</p>
                )}
                {char.secretMotive && activeTab === "principal" && (
                  <p className="text-xs text-purple-500 italic">秘密动机：{char.secretMotive}</p>
                )}
                <div className="mt-3 text-xs text-gray-400">
                  出场 {char.appearanceCount} 次
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 新建角色表单 Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-semibold mb-4">新建角色</h2>
              <form onSubmit={createCharacter} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">名称</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">级别</label>
                  <select
                    value={formData.tier}
                    onChange={(e) => setFormData({ ...formData, tier: e.target.value as Character["tier"] })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 outline-none"
                  >
                    <option value="principal">主要角色</option>
                    <option value="recurring">常驻角色</option>
                    <option value="walk_on">路人角色</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">外貌</label>
                  <textarea
                    value={formData.appearance}
                    onChange={(e) => setFormData({ ...formData, appearance: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">公开身份</label>
                  <input
                    type="text"
                    value={formData.publicRole}
                    onChange={(e) => setFormData({ ...formData, publicRole: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">秘密动机</label>
                  <textarea
                    value={formData.secretMotive}
                    onChange={(e) => setFormData({ ...formData, secretMotive: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">角色弧线目标</label>
                  <input
                    type="text"
                    value={formData.arcGoal}
                    onChange={(e) => setFormData({ ...formData, arcGoal: e.target.value })}
                    placeholder="如：怯懦 → 果敢"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 outline-none"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    创建
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
