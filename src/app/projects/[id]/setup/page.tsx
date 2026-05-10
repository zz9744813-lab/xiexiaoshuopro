"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Step = "premise" | "volume" | "outline" | "done";

interface PremiseCandidate {
  id: number;
  thesis: string;
  coreConflict: string;
  emotionalTone: string;
  readerPromise: string;
  varianceAxis: string;
}

export default function ProjectSetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("premise");
  const [loading, setLoading] = useState(false);
  const [premises, setPremises] = useState<PremiseCandidate[]>([]);
  const [selectedPremise, setSelectedPremise] = useState<PremiseCandidate | null>(null);
  const [volumeOutline, setVolumeOutline] = useState("");
  const [chapterOutlines, setChapterOutlines] = useState("");
  const [streamContent, setStreamContent] = useState("");

  async function generatePremises() {
    setLoading(true);
    setStreamContent("");
    try {
      const { id } = await params;
      const res = await fetch(`/api/projects/${id}/premise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setStreamContent(fullText);
        }
      }

      // 尝试解析 JSON
      try {
        const parsed = JSON.parse(fullText.trim());
        setPremises(parsed);
      } catch {
        // 尝试从流中提取 JSON
        const jsonMatch = fullText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          setPremises(JSON.parse(jsonMatch[0]));
        }
      }
    } catch (err) {
      console.error("生成命题失败:", err);
    } finally {
      setLoading(false);
    }
  }

  async function generateVolumeOutline() {
    if (!selectedPremise) return;
    setLoading(true);
    setStreamContent("");
    try {
      const { id } = await params;
      const res = await fetch(`/api/projects/${id}/volumes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thesis: selectedPremise.thesis,
          title: "第一卷",
          volumeNum: 1,
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setStreamContent(fullText);
        }
      }

      setVolumeOutline(fullText);
      setStep("outline");
    } catch (err) {
      console.error("生成卷大纲失败:", err);
    } finally {
      setLoading(false);
    }
  }

  async function generateChapterOutlines() {
    setLoading(true);
    setStreamContent("");
    try {
      const { id } = await params;
      let arcBeats = null;
      try {
        const parsed = JSON.parse(volumeOutline.trim());
        arcBeats = parsed.acts || parsed;
      } catch {
        // ignore
      }

      const res = await fetch(`/api/projects/${id}/outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arcBeats,
          chapterCount: 10,
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setStreamContent(fullText);
        }
      }

      setChapterOutlines(fullText);
      setStep("done");
    } catch (err) {
      console.error("生成章节细纲失败:", err);
    } finally {
      setLoading(false);
    }
  }

  async function finishSetup() {
    const { id } = await params;
    router.push(`/projects/${id}`);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/projects" className="text-gray-500 hover:text-gray-700 text-sm">
            ← 返回
          </Link>
          <h1 className="text-xl font-bold">项目设置向导</h1>
        </div>
      </header>

      {/* 步骤指示器 */}
      <div className="max-w-4xl mx-auto w-full px-6 py-4">
        <div className="flex items-center gap-2 text-sm">
          {(["premise", "volume", "outline", "done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                  step === s
                    ? "bg-blue-600 text-white"
                    : i < ["premise", "volume", "outline", "done"].indexOf(step)
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                }`}
              >
                {i + 1}
              </span>
              <span className={step === s ? "font-medium" : "text-gray-500"}>
                {s === "premise" && "选命题"}
                {s === "volume" && "卷大纲"}
                {s === "outline" && "章节细纲"}
                {s === "done" && "完成"}
              </span>
              {i < 3 && <span className="text-gray-300 mx-2">→</span>}
            </div>
          ))}
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-4">
        {/* Step 1: 命题选择 */}
        {step === "premise" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-2">选择卷命题</h2>
              <p className="text-gray-500 text-sm mb-4">
                AI 将生成 3 个差异化的命题候选，选择一个作为第一卷的核心主题。
              </p>
              {premises.length === 0 && (
                <button
                  onClick={generatePremises}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? "生成中..." : "生成命题候选"}
                </button>
              )}
            </div>

            {loading && streamContent && (
              <pre className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm overflow-auto max-h-64 whitespace-pre-wrap">
                {streamContent}
              </pre>
            )}

            {premises.length > 0 && (
              <div className="grid gap-4">
                {premises.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPremise(p)}
                    className={`text-left p-4 border rounded-xl transition-colors ${
                      selectedPremise?.id === p.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                        : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                        {p.varianceAxis}
                      </span>
                    </div>
                    <h3 className="font-semibold mb-1">{p.thesis}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      冲突：{p.coreConflict}
                    </p>
                    <p className="text-sm text-gray-500">
                      基调：{p.emotionalTone} · 承诺：{p.readerPromise}
                    </p>
                  </button>
                ))}

                {selectedPremise && (
                  <button
                    onClick={() => {
                      setStep("volume");
                      generateVolumeOutline();
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    确认命题，生成卷大纲
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: 卷大纲 */}
        {step === "volume" && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">卷大纲生成中</h2>
            <p className="text-sm text-gray-500">
              命题：{selectedPremise?.thesis}
            </p>
            <pre className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm overflow-auto max-h-96 whitespace-pre-wrap">
              {streamContent || "生成中..."}
            </pre>
          </div>
        )}

        {/* Step 3: 章节细纲 */}
        {step === "outline" && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">章节细纲</h2>
            {!chapterOutlines && (
              <button
                onClick={generateChapterOutlines}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "生成中..." : "生成章节细纲"}
              </button>
            )}
            {(loading || chapterOutlines) && (
              <pre className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm overflow-auto max-h-96 whitespace-pre-wrap">
                {streamContent || chapterOutlines}
              </pre>
            )}
          </div>
        )}

        {/* Step 4: 完成 */}
        {step === "done" && (
          <div className="space-y-6 text-center py-12">
            <div className="text-4xl mb-4">✓</div>
            <h2 className="text-2xl font-bold">项目设置完成</h2>
            <p className="text-gray-500">命题、卷大纲和章节细纲已生成，可以开始写作了。</p>
            <button
              onClick={finishSetup}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              进入项目
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
