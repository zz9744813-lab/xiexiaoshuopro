// src/db/queries/simulation.ts — Simulation query helpers
import { eq, desc } from 'drizzle-orm'
import { db } from '@/db'
import {
  simulations,
  simulationTurns,
  simulationCharacterStates,
} from '@/db/schema'

/** Create a new simulation */
export async function createSimulation(params: {
  projectId: string
  sceneContext: string
  participantIds: string[]
}) {
  const [sim] = await db
    .insert(simulations)
    .values({
      projectId: params.projectId,
      sceneContext: params.sceneContext,
      participantIds: params.participantIds,
      status: 'estimating',
    })
    .returning()
  return sim
}

/** Append a turn to a simulation */
export async function appendTurn(params: {
  simulationId: string
  speakerId: string
  speakerName: string
  content: string
  reasoning?: string
  visibleTo: string[]
}) {
  const [turn] = await db
    .insert(simulationTurns)
    .values({
      simulationId: params.simulationId,
      speakerId: params.speakerId,
      speakerName: params.speakerName,
      content: params.content,
      reasoning: params.reasoning || null,
      visibleTo: params.visibleTo,
    })
    .returning()
  return turn
}

/** Snapshot character state during simulation */
export async function snapshotCharacterState(params: {
  simulationId: string
  characterId: string
  state: Record<string, unknown>
}) {
  const [snap] = await db
    .insert(simulationCharacterStates)
    .values({
      simulationId: params.simulationId,
      characterId: params.characterId,
      state: params.state,
    })
    .returning()
  return snap
}

/** Get simulation with turns */
export async function getSimulation(simulationId: string) {
  const [sim] = await db.select().from(simulations).where(eq(simulations.id, simulationId))
  if (!sim) return null

  const turns = await db
    .select()
    .from(simulationTurns)
    .where(eq(simulationTurns.simulationId, simulationId))
    .orderBy(desc(simulationTurns.createdAt))

  return { ...sim, turns }
}
