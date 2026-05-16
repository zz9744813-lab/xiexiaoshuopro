'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Chapter {
  id: string;
  chapterIndex: number;
  title: string;
  contentMarkdown: string;
  pov?: string | null;
  faithfulnessScore?: string | null;
  faithfulnessReport?: Record<string, unknown> | null;
  changedMajorFacts: string[];
  status: string;
  sourceEventIds: string[];
  createdAt: string;
}

export default function ChapterDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!id) return;
    const r = await fetch(`/api/chapters/${id}`).then((x) => x.json());
    if (r.ok) {
      setChapter(r.data);
      setTitle(r.data.title);
      setContent(r.data.contentMarkdown);
    }
  }
  useEffect(() => {
    void load();
  }, [id]);

  async function save() {
    if (!id) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/chapters/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, contentMarkdown: content }),
      });
      const json = await res.json();
      if (json.ok) {
        setEditing(false);
        await load();
      } else {
        alert(json.error?.message ?? '保存失败');
      }
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: 'draft' | 'reviewing' | 'published' | 'archived') {
    if (!id) return;
    const res = await fetch(`/api/chapters/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (json.ok) await load();
  }

  if (!chapter) {
    return (
      <main className="p-6">
        <p className="text-zinc-500">加载中...</p>
      </main>
    );
  }

  const score = chapter.faithfulnessScore ? Number(chapter.faithfulnessScore) : 0;

  return (
    <main className="p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-4 text-sm">
          <a href="/chapters" className="text-zinc-500 hover:underline">
            ← 章节列表
          </a>
          <span className="ml-auto text-xs text-zinc-500">
            状态：{chapter.status} · 忠实度 {(score * 100).toFixed(0)}%
          </span>
          <a
            href={`/api/chapters/${chapter.id}/export`}
            className="px-3 py-1 text-xs border rounded"
          >
            下载 .md
          </a>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1 text-xs border rounded"
            >
              编辑
            </button>
          )}
        </div>

        {chapter.changedMajorFacts.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-800 rounded text-sm">
            <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
              ⚠ 忠实度警告（{chapter.changedMajorFacts.length} 项）
            </p>
            <ul className="text-xs space-y-1">
              {chapter.changedMajorFacts.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
              请人工对照原始事件复核，再决定是否发布。
            </p>
          </div>
        )}

        {editing ? (
          <div className="space-y-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="w-full px-3 py-2 text-xl font-bold border rounded bg-white dark:bg-zinc-900"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={100000}
              rows={30}
              className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-900 font-mono text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={busy}
                className="px-3 py-1 text-sm bg-zinc-900 text-white rounded disabled:opacity-50"
              >
                {busy ? '保存中...' : '保存'}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setTitle(chapter.title);
                  setContent(chapter.contentMarkdown);
                }}
                className="px-3 py-1 text-sm border rounded"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <article className="prose dark:prose-invert max-w-none">
            <h1 className="text-3xl font-bold mb-6">
              第 {chapter.chapterIndex + 1} 章 · {chapter.title}
            </h1>
            <div className="whitespace-pre-wrap leading-relaxed text-zinc-800 dark:text-zinc-200">
              {chapter.contentMarkdown}
            </div>
          </article>
        )}

        <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
          <button
            onClick={() => changeStatus('reviewing')}
            disabled={chapter.status === 'reviewing'}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            标记为审核中
          </button>
          <button
            onClick={() => changeStatus('published')}
            disabled={chapter.status === 'published'}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            发布
          </button>
          <button
            onClick={() => changeStatus('archived')}
            className="px-3 py-1 text-sm border rounded"
          >
            归档
          </button>
        </div>
      </div>
    </main>
  );
}
