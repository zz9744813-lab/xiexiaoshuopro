'use client'
import React from 'react'

export default function StreamingProgress({ progress, onCancel }: { progress: number; onCancel: () => void }) {
  return <div className="streaming-progress"><progress value={progress} max={100} /><button onClick={onCancel}>Cancel</button></div>
}
