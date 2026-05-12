'use client'

import { useState, useEffect } from 'react'

interface Simulation {
  id: string
  sceneContext: string
  status: string
  participantIds: string[]
  createdAt: string
}

interface Turn {
  id: string
  speakerName: string
  content: string
  reasoning?: string
}

export default function SimulationCenterPage() {
  const [simulations, setSimulations] = useState<Simulation[]>([])
  const [activeSim, setActiveSim] = useState<Simulation | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [sceneInput, setSceneInput] = useState('')
  const [participants, setParticipants] = useState('')

  useEffect(() => {
    fetch('/api/simulations')
      .then(r => r.json())
      .then(setSimulations)
      .catch(console.error)
  }, [])

  async function loadTurns(simId: string) {
    const res = await fetch(`/api/simulations/${simId}/turns`)
    const data = await res.json()
    setTurns(data)
  }

  async function handleCreateSim() {
    if (!sceneInput) return
    const res = await fetch('/api/simulations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sceneContext: sceneInput,
        participantIds: participants.split(',').map(s => s.trim()).filter(Boolean),
      }),
    })
    if (res.ok) {
      const sim = await res.json()
      setSimulations(prev => [sim, ...prev])
      setActiveSim(sim)
      setSceneInput('')
      setParticipants('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <h1 className="text-xl font-bold">🎭 推演中心</h1>
          <p className="text-sm text-gray-500">模拟角色在场景中的对话和行为</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 flex gap-6">
        {/* Left: Create + List */}
        <div className="w-80 space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
            <h3 className="text-sm font-semibold mb-3">新建推演</h3>
            <textarea
              value={sceneInput}
              onChange={e => setSceneInput(e.target.value)}
              placeholder="场景描述...
例：酒馆深夜，主角偶遇仇人"
              className="w-full text-sm border border-gray-300 rounded p-2 mb-2 h-24 resize-none"
            />
            <input
              type="text"
              value={participants}
              onChange={e => setParticipants(e.target.value)}
              placeholder="参与者 ID（逗号分隔）"
              className="w-full text-sm border border-gray-300 rounded p-2 mb-3"
            />
            <button
              onClick={handleCreateSim}
              className="w-full px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
            >
              🚀 启动推演
            </button>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-500">历史推演</h3>
            {simulations.map(sim => (
              <div
                key={sim.id}
                onClick={() => { setActiveSim(sim); loadTurns(sim.id) }}
                className={`p-3 rounded border cursor-pointer text-sm ${
                  activeSim?.id === sim.id
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50'
                }`}
              >
                <p className="font-medium truncate">{sim.sceneContext.slice(0,40)}...</p>
                <p className="text-xs text-gray-400 mt-1">
                  {sim.participantIds.length} 人 · {sim.status}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Turn Display */}
        <div className="flex-1">
          {activeSim ? (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 min-h-[70vh]">
              <h2 className="text-lg font-semibold mb-4">{activeSim.sceneContext}</h2>
              <div className="space-y-4">
                {turns.length === 0 ? (
                  <p className="text-gray-400 text-center py-12">
                    推演即将开始...
                  </p>
                ) : (
                  turns.map(turn => (
                    <div key={turn.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {turn.speakerName[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{turn.speakerName}</span>
                          <span className="text-xs text-gray-400">说：</span>
                        </div>
                        <p className="text-sm leading-relaxed">{turn.content}</p>
                        {turn.reasoning && (
                          <details className="mt-1">
                            <summary className="text-xs text-gray-400 cursor-pointer">推理过程</summary>
                            <p className="text-xs text-gray-500 mt-1 italic">{turn.reasoning}</p>
                          </details>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[70vh] bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
              <div className="text-center text-gray-400">
                <p className="text-4xl mb-2">🎭</p>
                <p>选择或创建一个推演来开始</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
