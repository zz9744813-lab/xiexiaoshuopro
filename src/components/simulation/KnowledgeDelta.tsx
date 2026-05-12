'use client'
import React from 'react'

export default function KnowledgeDelta({ deltas }: { deltas: any[] }) {
  return <div className="knowledge-delta">{deltas?.length || 0} deltas</div>
}
