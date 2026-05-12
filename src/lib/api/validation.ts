// src/lib/api/validation.ts
import { z } from 'zod'

export const schemas = {
  createProject: z.object({
    title: z.string().min(1).max(200),
    genre: z.string().min(1),
    seed: z.string().optional(),
  }),
  createVolume: z.object({
    title: z.string().min(1),
    thesis: z.string().optional(),
    arcBeats: z.array(z.any()).optional(),
  }),
  saveChapter: z.object({
    contentMd: z.string().min(1),
    source: z.enum(['initial','rewrite','simulation_inserted','manual','merge','auto_fix']).default('initial'),
    versionLabel: z.string().optional(),
  }),
  rewriteSection: z.object({
    projectId: z.string().uuid(),
    section: z.string().min(1),
    instruction: z.string().min(1),
    context: z.string().optional(),
  }),
  createPremise: z.object({
    projectId: z.string().uuid(),
    genre: z.string(),
    seed: z.string().optional(),
  }),
  createOutline: z.object({
    projectId: z.string().uuid(),
    volumeId: z.string().uuid(),
    premise: z.string().optional(),
  }),
  createSimulation: z.object({
    projectId: z.string().uuid(),
    directorGoal: z.string().min(1),
    characters: z.array(z.object({
      id: z.string(),
      name: z.string(),
      publicRole: z.string(),
      secretMotive: z.string().optional(),
      voiceMd: z.string(),
      knowledgeFacts: z.array(z.string()).optional(),
    })),
    maxTurns: z.number().optional().default(90),
  }),
}

export function validate<T extends keyof typeof schemas>(
  name: T,
  body: unknown
): { ok: true; data: z.infer<typeof schemas[T]> } | { ok: false; error: any } {
  const result = schemas[name].safeParse(body)
  if (result.success) return { ok: true, data: result.data as any }
  return { ok: false, error: result.error.flatten() }
}
