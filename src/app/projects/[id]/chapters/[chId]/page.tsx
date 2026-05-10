"use client";

import { useState, useRef, lazy, Suspense } from "react";
import Link from "next/link";

const TiptapEditor = lazy(() => import("@/components/editor/TiptapEditor").then(m => ({ default: m.TiptapEditor })));

export default function ChapterEditorPage({
  params,
}: {
  params: Promise<{ id: string; chId: string }>;
}) {
  const [content, setContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [outline, setOutline] = useState("");
  const [summary, setSummary] = useState("");
  const [saved, setSaved] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function handleGenerate() {
    if (isGenerating) {
      abortRef.current?.abort();
      setIsGenerating(false);
      return;
    }

    setIsGenerating(true);
    setContent("");
    setSaved(false);
    setSummary("");

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

      let fullContent = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // toTextStreamResponse 直接输出纯文本
        fullContent += chunk;
        setContent(fullContent);
      }

      // 生成完成后自动保存
      if (fullContent.length > 0) {
        await handleSave(fullContent);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("生成错误:", err);
      }
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave(text?: string) {
    const contentToSave = text || content;
    if (!contentToSave) return;

    setIsSaving(true);
    try {
      const { chId } = await params;
      const res = await fetch(`/api/chapters/${chId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentMd: contentToSave,
          source: "initial",
        }),
      });

      if (res.ok) {
        setSaved(true);
      }
    } catch (err) {
      console.error("保存失败:", err);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSummarize() {
    setIsSummarizing(true);
    try {
      const { chId } = await params;
      const res = await fetch(`/api/chapters/${chId}/summarize`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setSummary(data.shortSummary || "摘要已生成");
      }
    } catch (err) {
      console.error("摘要生成失败:", err);
    } finally {
      setIsSummarizing(false);
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
            {saved && <span className="text-xs text-green-600">已保存</span>}
          </div>
          <div className="flex items-center gap-2">
            {isGenerating && (
              <span className="text-sm text-blue-600 animate-pulse">AI 生成中...</span>
            )}
            {content && !isGenerating && (
              <>
                <button
                  onClick={() => handleSave()}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {isSaving ? "保存中..." : "保存"}
                </button>
                <button
                  onClick={handleSummarize}
                  disabled={isSummarizing}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {isSummarizing ? "生成摘要..." : "生成摘要"}
                </button>
              </>
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
          <div className="mt-4">
            <h4 className="text-xs font-medium text-gray-500 mb-2">写作提示</h4>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>· 描述本章要推进的情节</li>
              <li>· 列出出场人物</li>
              <li>· 指定 POV 视角</li>
              <li>· 说明章末钩子意图</li>
            </ul>
          </div>
        </aside>

        {/* 中间：编辑器 */}
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            {content ? (
              <Suspense fallback={
                <textarea
                  value={content}
                  onChange={(e) => { setContent(e.target.value); setSaved(false); }}
                  className="w-full min-h-[70vh] p-0 text-base leading-relaxed bg-transparent border-none outline-none resize-none font-serif"
                />
              }>
                <TiptapEditor
                  content={content}
                  onChange={(text) => { setContent(text); setSaved(false); }}
                  placeholder="章节内容..."
                />
              </Suspense>
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
          <div className="space-y-4 text-sm">
            <div className="text-gray-500">
              <span className="font-medium text-gray-700 dark:text-gray-300">字数：</span>
              {content.length}
            </div>
            <div className="text-gray-500">
              <span className="font-medium text-gray-700 dark:text-gray-300">状态：</span>
              {isGenerating ? "生成中" : saved ? "已保存" : content ? "未保存" : "待生成"}
            </div>

            {summary && (
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold mb-2">章节摘要</h4>
                <p className="text-xs text-gray-500 leading-relaxed">{summary}</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
