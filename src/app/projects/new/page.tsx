"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const GENRES = [
  { id: "xianxia", label: "仙侠" },
  { id: "romance", label: "言情" },
  { id: "scifi", label: "科幻" },
  { id: "mystery", label: "悬疑" },
  { id: "literary", label: "严肃文学" },
  { id: "horror", label: "恐怖" },
  { id: "fantasy", label: "奇幻" },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [seed, setSeed] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !genre) return;

    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, genre, seed }),
      });
      const data = await res.json();
      if (data.id) {
        router.push(`/projects/${data.id}`);
      }
    } catch (err) {
      console.error("创建项目失败:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/projects" className="text-gray-500 hover:text-gray-700">
            ← 返回
          </Link>
          <h1 className="text-xl font-bold">创建新项目</h1>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 标题 */}
          <div>
            <label className="block text-sm font-medium mb-2">项目标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="你的小说叫什么名字？"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              required
            />
          </div>

          {/* 类型 */}
          <div>
            <label className="block text-sm font-medium mb-2">小说类型</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {GENRES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGenre(g.id)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    genre === g.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                      : "border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* 种子创意 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              种子创意 <span className="text-gray-400 font-normal">(可选)</span>
            </label>
            <textarea
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="描述你的故事核心创意、想探讨的主题、或任何灵感碎片..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          {/* 提交 */}
          <button
            type="submit"
            disabled={!title || !genre || loading}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? "创建中..." : "创建项目"}
          </button>
        </form>
      </main>
    </div>
  );
}
