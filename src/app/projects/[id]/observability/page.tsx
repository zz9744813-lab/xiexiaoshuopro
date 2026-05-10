"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Job {
  id: string;
  type: string;
  status: string;
  workflowName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  totalCostUsd: string | null;
  totalTokensIn: number | null;
  totalTokensOut: number | null;
}

export default function ObservabilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [projectId, setProjectId] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(({ id }) => {
      setProjectId(id);
      setLoading(false);
      // TODO: fetch jobs from API
    });
  }, [params]);

  // 模拟数据
  const mockStats = {
    totalCost: "$0.00",
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalJobs: 0,
    avgDuration: "0s",
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href={`/projects/${projectId}`} className="text-gray-500 hover:text-gray-700 text-sm">
            ← 项目
          </Link>
          <h1 className="text-xl font-bold">可观测性</h1>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
            <h3 className="text-xs font-medium text-gray-500 mb-1">总花费</h3>
            <p className="text-xl font-bold">{mockStats.totalCost}</p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
            <h3 className="text-xs font-medium text-gray-500 mb-1">输入 Tokens</h3>
            <p className="text-xl font-bold">{mockStats.totalTokensIn.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
            <h3 className="text-xs font-medium text-gray-500 mb-1">输出 Tokens</h3>
            <p className="text-xl font-bold">{mockStats.totalTokensOut.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
            <h3 className="text-xs font-medium text-gray-500 mb-1">总任务数</h3>
            <p className="text-xl font-bold">{mockStats.totalJobs}</p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
            <h3 className="text-xs font-medium text-gray-500 mb-1">平均耗时</h3>
            <p className="text-xl font-bold">{mockStats.avgDuration}</p>
          </div>
        </div>

        {/* Jobs 列表 */}
        <h2 className="text-lg font-semibold mb-4">任务历史</h2>
        {loading ? (
          <p className="text-gray-400">加载中...</p>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12 text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
            <p>暂无任务记录</p>
            <p className="text-sm mt-2">生成章节、运行审查后，任务记录会出现在这里</p>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${
                    job.status === "completed" ? "bg-green-500" :
                    job.status === "running" ? "bg-blue-500 animate-pulse" :
                    job.status === "failed" ? "bg-red-500" : "bg-gray-400"
                  }`} />
                  <span className="font-medium">{job.type}</span>
                  {job.workflowName && (
                    <span className="text-gray-400">{job.workflowName}</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-gray-400">
                  {job.totalCostUsd && <span>${job.totalCostUsd}</span>}
                  {job.totalTokensOut && <span>{job.totalTokensOut} tok</span>}
                  <span>{job.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
