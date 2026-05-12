'use client'
import { useEffect, useState } from 'react'

interface PlotThread {
  id: string
  title: string
  kind: string
  status: string
  importance: number
}

export default function PlotThreadsPage({ params }: { params: Promise<{ id: string }> }) {
  const [threads, setThreads] = useState<PlotThread[]>([])
  const [projectId, setProjectId] = useState<string>()

  useEffect(() => {
    params.then(p => {
      setProjectId(p.id)
      fetch(`/api/projects/${p.id}/plot-threads`)
        .then(r => r.json())
        .then(setThreads)
    })
  }, [params])

  const columns = ['planted', 'developing', 'paying_off', 'paid_off', 'abandoned']

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">伏笔看板</h1>
      <div className="grid grid-cols-5 gap-4">
        {columns.map(col => (
          <div key={col} className="bg-gray-100 rounded p-3">
            <h2 className="font-bold mb-2">{col}</h2>
            {threads.filter(t => t.status === col).map(t => (
              <div key={t.id} className="bg-white rounded p-2 mb-2 shadow">
                <div className="font-semibold">{t.title}</div>
                <div className="text-xs text-gray-500">
                  {t.kind} · 重要度 {t.importance}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
