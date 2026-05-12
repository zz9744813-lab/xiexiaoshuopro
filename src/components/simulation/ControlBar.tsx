'use client'
import React from 'react'

export default function ControlBar({ onPause, onResume, onStop }: { onPause: () => void; onResume: () => void; onStop: () => void }) {
  return <div className="control-bar"><button onClick={onPause}>Pause</button><button onClick={onResume}>Resume</button><button onClick={onStop}>Stop</button></div>
}
