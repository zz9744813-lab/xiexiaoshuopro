'use client'
import React, { useState } from 'react'

export default function ChapterEditor({ chapterId, projectId }: { chapterId: string; projectId: string }) {
  const [content, setContent] = useState('')
  return <div className="chapter-editor"><textarea value={content} onChange={e => setContent(e.target.value)} /></div>
}
