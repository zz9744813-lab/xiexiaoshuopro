'use client'
import React from 'react'

export default function TurnBubble({ turn }: { turn: any }) {
  return <div className="turn-bubble">{turn.utterance}</div>
}
