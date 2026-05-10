"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Issue {
  id: string;
  scope: string;
  scopeId: string | null;
  axis: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string | null;
  evidence: string | null;
  proposedFix: string | null;
  status: string;
  reviewerAgent: string | null;
  createdAt: string;
}

export default function IssuesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [projectId, setProjectId] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "resolved" | "dismissed">("all");

  useEffect(() => {
    params.then(({ id }) => {
      setProjectId(id);
      fetchIssues(id);
    });
  }, [params]);

  async function fetchIssues(id: string) {
    try {
      const res = await fetch(`/api/projects/${id}/issues`);
      const data = await res.json();
      setIssues(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("获取 issues 失败:", err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = filter === "all" ? issues : issues.filter((i) => i.status === filter);

  const severityColors = {
    critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    info: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  };

  const axisLabels: Record<string, string> = {
    logic: "逻辑", voice: "声音", canon: "设定", pacing: "节奏",
    theme: "主题", genre: "类型", reader: "读者", aislop: "AI味",
    character_promotion: "角色升级", relationship: "关系", continuity: "连续性",
  };

  const statusCounts = {
    all: issues.length,
    open: issues.filter((i) => i.status === "open").length,
    resolved: issues.filter((i) => ["resolved", "auto_fixed"].includes(i.status)).length,
    dismissed: issues.filter((i) => i.status === "dismissed").length,
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href={`/projects/${projectId}`} className="text-gray-500 hover:text-gray-700 text-sm">
            ← 项目
          </Link>
          <h1 className="text-xl font-bold">Issue 中心</h1>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        {/* 过滤器 */}
        <div className="flex gap-2 mb-6">
          {(["all", "open", "resolved", "dismissed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {f === "all" && `全部 (${statusCounts.all})`}
              {f === "open" && `待处理 (${statusCounts.open})`}
              {f === "resolved" && `已解决 (${statusCounts.resolved})`}
              {f === "dismissed" && `已忽略 (${statusCounts.dismissed})`}
            </button>
          ))}
        </div>

        {/* Issue 列表 */}
        {loading ? (
          <p className="text-gray-400">加载中...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p>暂无 Issue</p>
            <p className="text-sm mt-2">生成章节后，系统会自动审查并创建 Issue</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((issue) => (
              <div
                key={issue.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 text-xs rounded ${severityColors[issue.severity]}`}>
                    {issue.severity}
                  </span>
                  <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                    {axisLabels[issue.axis] || issue.axis}
                  </span>
                  {issue.reviewerAgent && (
                    <span className="text-xs text-gray-400">by {issue.reviewerAgent}</span>
                  )}
                </div>
                <h3 className="font-medium mb-1">{issue.title}</h3>
                {issue.description && (
                  <p className="text-sm text-gray-500 mb-2">{issue.description}</p>
                )}
                {issue.evidence && (
                  <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded mt-2 whitespace-pre-wrap">
                    {issue.evidence}
                  </pre>
                )}
                {issue.proposedFix && (
                  <p className="text-xs text-green-600 mt-2">建议：{issue.proposedFix}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
