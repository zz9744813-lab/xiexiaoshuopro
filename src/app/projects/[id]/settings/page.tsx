"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ProjectSettings {
  title: string;
  genre: string;
  voiceMd: string;
  authorNotes: string;
  safetyLevel: string;
}

export default function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [projectId, setProjectId] = useState("");
  const [settings, setSettings] = useState<ProjectSettings>({
    title: "",
    genre: "",
    voiceMd: "",
    authorNotes: "",
    safetyLevel: "normal",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    params.then(({ id }) => {
      setProjectId(id);
      fetchProject(id);
    });
  }, [params]);

  async function fetchProject(id: string) {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSettings({
          title: data.title || "",
          genre: data.genre || "",
          voiceMd: data.voiceMd || "",
          authorNotes: data.authorNotes || "",
          safetyLevel: data.safetyLevel || "normal",
        });
      }
    } catch (err) {
      console.error("获取项目设置失败:", err);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error("保存失败:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href={`/projects/${projectId}`} className="text-gray-500 hover:text-gray-700 text-sm">
            ← 项目
          </Link>
          <h1 className="text-xl font-bold">项目设置</h1>
          {saved && <span className="text-sm text-green-600">已保存</span>}
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">项目标题</label>
            <input
              type="text"
              value={settings.title}
              onChange={(e) => setSettings({ ...settings, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">小说类型</label>
            <select
              value={settings.genre}
              onChange={(e) => setSettings({ ...settings, genre: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none"
            >
              <option value="xianxia">仙侠</option>
              <option value="romance">言情</option>
              <option value="scifi">科幻</option>
              <option value="mystery">悬疑</option>
              <option value="literary">严肃文学</option>
              <option value="horror">恐怖</option>
              <option value="fantasy">奇幻</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">安全级别</label>
            <select
              value={settings.safetyLevel}
              onChange={(e) => setSettings({ ...settings, safetyLevel: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none"
            >
              <option value="strict">严格（商用模型审查）</option>
              <option value="normal">正常（DeepSeek 主力）</option>
              <option value="unrestricted">无限制（自部署兜底）</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              无限制模式会优先使用自部署模型，绕开商用审查限制
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">项目声音卡（叙述者声音）</label>
            <textarea
              value={settings.voiceMd}
              onChange={(e) => setSettings({ ...settings, voiceMd: e.target.value })}
              rows={6}
              placeholder="描述这部小说的整体文风、叙述风格、用词偏好..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none resize-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">作者备注</label>
            <textarea
              value={settings.authorNotes}
              onChange={(e) => setSettings({ ...settings, authorNotes: e.target.value })}
              rows={4}
              placeholder="给 AI 的额外指引，如特殊要求、禁忌、偏好..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none resize-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "保存中..." : "保存设置"}
          </button>
        </form>
      </main>
    </div>
  );
}
