'use client'
import React, { useState } from 'react'

export default function InjectionDialog({ onInject }: { onInject: (text: string) => void }) {
  const [text, setText] = useState('')
  return <div className="injection-dialog"><textarea value={text} onChange={e => setText(e.target.value)} /><button onClick={() => onInject(text)}>Inject</button></div>
}
