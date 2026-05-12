'use client'
import React from 'react'

export default function SimulationPage({ params }: { params: Promise<{ id: string; simId: string }> }) {
  const [data, setData] = React.useState<{ id: string; simId: string } | null>(null)
  React.useEffect(() => { params.then(setData) }, [])
  if (!data) return <div>Loading...</div>
  return <div>Simulation {data.simId}</div>
}
