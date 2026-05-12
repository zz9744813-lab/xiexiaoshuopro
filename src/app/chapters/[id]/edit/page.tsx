'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Chapter {
  id: string
  title: string
  chapterNumber: number
  volumeId: string
  status: 'draft' | 'reviewing' | 'published'
}

export default function ChapterEditPage() {
  const params = useParams()
  const router = useRouter()
  const chapterId = params.id as string

  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [content, setContent] = useState('')
  const [versionLabel, setVersionLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetch(`/api/chapters/${chapterId}`)
      .then(r => r.json())
      .then(data => {
        setChapter(data)
        setContent(data.latestContent || '')
      })
      .catch(console.error)
  }, [chapterId])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/chapters/${chapterId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentMd: content, source: 'editor', versionLabel }),
      })
      if (res.ok) {
        setVersionLabel('')
        alert('✅ 已保存')
      } else {
        alert('❌ 保存失败')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/chapters/${chapterId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'demo',
          outline: '章节大纲',
          genre: '玄幻',
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setContent(data.content)
        alert('✅ AI 生成完成')
      } else {
        alert('❌ 生成失败')
      }
    } finally {
      setGenerating(false)
    }
  }

  if (!chapter) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-500">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <button
              onClick={() => router.back()}
              className="text-sm text-gray-500 hover:text-gray-700 mb-1"
            >
              ← 返回
            </button>
            <h1 className="text-xl font-bold">
              第 {chapter.chapterNumber} 章：{chapter.title || '未命名'}
            </h1>
            <span className={`text-xs px-2 py-0.5 rounded ${
              chapter.status === 'published' ? 'bg-green-100 text-green-700' :
              chapter.status === 'reviewing' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {chapter.status}
            </span>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={versionLabel}
              onChange={e => setVersionLabel(e.target.value)}
              placeholder="版本标签（可选）"
              className="text-sm border border-gray-300 rounded px-3 py-1.5 w-36"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
            >
              {generating ? '生成中...' : 'AI 生成'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {/* Editor Area */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-400">Markdown 编辑器</span>
            <span className="text-xs text-gray-400">
              {content.length} 字
            </span>
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            className="w-full h-[calc(100vh-280px)] p-6 font-mono text-sm bg-transparent outline-none resize-none"
            placeholder="在此编写章节内容，或点击「AI 生成」自动生成..."
          />
        </div>

        {/* Quick Actions */}
        <div className="mt-4 flex gap-4">
          <button className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">
            📋 复制全文
          </button>
          <button className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">
            📊 统计分析
          </button>
          <button className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">
            🔍 审查运行
          </button>
        </div>
      </main>
    </div>
  )
}
