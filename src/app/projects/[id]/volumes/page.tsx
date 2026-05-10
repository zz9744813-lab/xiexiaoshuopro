"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Volume {
  id: string;
  volumeNum: number;
  title: string;
  thesis: string | null;
  status: string;
  createdAt: string;
}

interface ChapterOutline {
  id: string;
  chapterNum: number;
  title: string;
  beatsMd: string | null;
  targetWordCount: number;
  status: string;
  hookIntent: string | null;
}

export default function VolumesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [projectId, setProjectId] = useState("");
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [selectedVolume, setSelectedVolume] = useState<Volume | null>(null);
  const [chapters, setChapters] = useState<ChapterOutline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(({ id }) => {
      setProjectId(id);
      fetchVolumes(id);
    });
  }, [params]);

  async function fetchVolumes(id: string) {
    try {
      const res = await fetch(`/api/projects/${id}/volumes`);
      const data = await res.json();
      setVolumes(Array.isArray(data) ? data : []);
      if (data.length > 0) {
        setSelectedVolume(data[0]);
      }
    } catch (err) {
      console.error("获取卷列表失败:", err);
    } finally {
      setLoading(false);
    }
  }

  const statusLabels: Record<string, string> = {
    planning: "规划中",
    writing: "写作中",
    reviewing: "审阅中",
    done: "已完结",
    outline: "待写",
    drafting: "生成中",
    drafted: "初稿",
    reviewed: "已审",
    finalized: "定稿",
    locked: "锁定",
  };

  const statusColors: Record<string, string> = {
    planning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    writing: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    reviewing: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    done: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    outline: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    drafted: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    finalized: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/projects/${projectId}`} className="text-gray-500 hover:text-gray-700 text-sm">
              ← 项目
            </Link>
            <h1 className="text-xl font-bold">卷章管理</h1>
          </div>
          <Link
            href={`/projects/${projectId}/setup`}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            新建卷
          </Link>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* 左侧：卷列表 */}
        <aside className="w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">卷列表</h3>
          {loading ? (
            <p className="text-sm text-gray-400">加载中...</p>
          ) : volumes.length === 0 ? (
            <p className="text-sm text-gray-400">暂无卷</p>
          ) : (
            <div className="space-y-2">
              {volumes.map((vol) => (
                <button
                  key={vol.id}
                  onClick={() => setSelectedVolume(vol)}
                  className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
                    selectedVolume?.id === vol.id
                      ? "bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <div className="font-medium">第{vol.volumeNum}卷 · {vol.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-1.5 py-0.5 text-xs rounded ${statusColors[vol.status] || ""}`}>
                      {statusLabels[vol.status] || vol.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* 右侧：章节列表 */}
        <main className="flex-1 p-6">
          {selectedVolume ? (
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-semibold">{selectedVolume.title}</h2>
                {selectedVolume.thesis && (
                  <p className="text-sm text-gray-500 mt-1">命题：{selectedVolume.thesis}</p>
                )}
              </div>

              {chapters.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p>暂无章节细纲</p>
                  <p className="text-sm mt-2">在项目设置向导中生成章节细纲</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {chapters.map((ch) => (
                    <Link
                      key={ch.id}
                      href={`/projects/${projectId}/chapters/${ch.id}`}
                      className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm text-gray-500">第{ch.chapterNum}章</span>
                          <h3 className="font-medium">{ch.title}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{ch.targetWordCount}字</span>
                          <span className={`px-2 py-0.5 text-xs rounded ${statusColors[ch.status] || ""}`}>
                            {statusLabels[ch.status] || ch.status}
                          </span>
                        </div>
                      </div>
                      {ch.hookIntent && (
                        <p className="text-xs text-gray-400 mt-2">钩子：{ch.hookIntent}</p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              选择一个卷查看章节
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
