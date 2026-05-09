"use client";

import { useState, useRef } from "react";
import Link from "next/link";

export default function ChapterEditorPage({
  params,
}: {
  params: Promise<{ id: string; chId: string }>;
}) {
  const [content, setContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [outline, setOutline] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function handleGenerate() {
    if (isGenerating) {
      abortRef.current?.abort();
      setIsGenerating(false);
      return;
    }

    setIsGenerating(true);
    setContent("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { chId } = await params;
      const res = await fetch(`/api/chapters/${chId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outline: outline || "写一个精彩的开头章节",
          genre: "xianxia",
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error("生成失败");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("无法读取流");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // 解析 AI SDK 的 data stream 格式
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("0:")) {
            // text delta
            try {
              const text = JSON.parse(line.slice(2));
              setContent((prev) => prev + text);
            } catch {
              // skip malformed lines
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("生成错误:", err);
      }
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶栏 */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
        <div className="max-w-full mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/projects" className="text-gray-500 hover:text-gray-700 text-sm">
              ← 返回
            </Link>
            <span className="text-sm text-gray-400">章节编辑器</span>
          </div>
          <div className="flex items-center gap-3">
            {isGenerating && (
              <span className="text-sm text-blue-600 animate-pulse">AI 生成中...</span>
            )}
            <button
              onClick={handleGenerate}
              className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                isGenerating
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {isGenerating ? "停止" : "生成章节"}
            </button>
          </div>
        </div>
      </header>

      {/* 主体 */}
      <div className="flex-1 flex">
        {/* 左侧：细纲 */}
        <aside className="w-80 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 overflow-y-auto hidden lg:block">
          <h3 className="text-sm font-semibold mb-3">章节细纲</h3>
          <textarea
            value={outline}
            onChange={(e) => setOutline(e.target.value)}
            placeholder="在这里写章节细纲，AI 会根据它来生成正文..."
            className="w-full h-64 p-3 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 resize-none outline-none focus:ring-2 focus:ring-blue-500"
          />
        </aside>

        {/* 中间：编辑器 */}
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            {content ? (
              <article className="prose prose-gray dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-base">
                {content}
              </article>
            ) : (
              <div className="text-center py-20 text-gray-400">
                <p className="mb-2">在左侧写好细纲，然后点击"生成章节"</p>
                <p className="text-sm">AI 将流式生成章节正文</p>
              </div>
            )}
          </div>
        </main>

        {/* 右侧：信息面板 */}
        <aside className="w-72 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 overflow-y-auto hidden xl:block">
          <h3 className="text-sm font-semibold mb-3">信息</h3>
          <div className="space-y-4 text-sm text-gray-500">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">字数：</span>
              {content.length}
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">状态：</span>
              {isGenerating ? "生成中" : content ? "已生成" : "待生成"}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
