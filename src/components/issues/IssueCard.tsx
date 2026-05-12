'use client'
import React from 'react'

export default function IssueCard({ issue }: { issue: any }) {
  return <div className="issue-card"><h3>{issue.title}</h3><span>{issue.severity}</span></div>
}
