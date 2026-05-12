'use client'

import { useState, useEffect } from 'react'

interface Issue {
  id: string
  axis: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  evidence: string
  status: string
  chapterId: string
  createdAt: string
}

export default function IssueCenterPage() {
  const [issues, setIssues] = useState<Issue[]>([])
  const [filter, setFilter] = useState<'all'|'open'|'resolved'>('open')
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)

  useEffect(() => {
    fetch('/api/issues?status=open')
      .then(r => r.json())
      .then(setIssues)
      .catch(console.error)
  }, [])

  const filtered = issues.filter(i => {
    if (filter === 'open') return i.status === 'open'
    if (filter === 'resolved') return i.status === 'resolved'
    return true
  })

  const severityColors = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200',
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <h1 className="text-xl font-bold">Issue 中心</h1>
          <p className="text-sm text-gray-500">
            {issues.length} 个 issue · {issues.filter(i=>i.severity==='critical').length} critical
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 flex gap-6">
        {/* Issue List */}
        <div className="flex-1">
          <div className="flex gap-2 mb-4">
            {(['all','open','resolved'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-sm rounded ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800'
                }`}
              >
                {f === 'all' ? '全部' : f === 'open' ? '待处理' : '已解决'}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              🎉 没有待处理的 issue
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(issue => (
                <div
                  key={issue.id}
                  onClick={() => setSelectedIssue(issue)}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-900 ${
                    selectedIssue?.id === issue.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded border ${severityColors[issue.severity]}`}>
                      {issue.severity}
                    </span>
                    <span className="text-xs text-gray-400">{issue.axis}</span>
                    <span className="text-xs text-gray-400">{issue.chapterId.slice(0,8)}</span>
                  </div>
                  <h3 className="font-medium text-sm">{issue.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{issue.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Issue Detail */}
        {selectedIssue && (
          <div className="w-96 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs px-2 py-0.5 rounded border ${severityColors[selectedIssue.severity]}`}>
                {selectedIssue.severity}
              </span>
              <span className="text-xs text-gray-400">{selectedIssue.axis}</span>
            </div>
            <h2 className="text-lg font-bold mb-2">{selectedIssue.title}</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{selectedIssue.description}</p>
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-500 mb-1">📝 证据</h4>
              <blockquote className="text-xs text-gray-500 border-l-2 border-gray-300 pl-3 italic">
                {selectedIssue.evidence}
              </blockquote>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                🔧 自动修复
              </button>
              <button className="flex-1 px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-100 dark:border-gray-700">
                ✔ 标记已解决
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
