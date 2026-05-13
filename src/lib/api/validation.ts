// src/lib/api/validation.ts
import { z } from 'zod'

export const schemas = {
 // /api/projects
 createProject: z.object({
 title: z.string().min(1).max(200),
 genre: z.string().min(1),
 seed: z.string().optional(),
 }),
 updateProject: z.object({
 title: z.string().min(1).max(200).optional(),
 voiceMd: z.string().optional(),
 status: z.string().optional(),
 genre: z.string().optional(),
 }),
 generatePremise: z.object({
 seed: z.string().optional(),
 genre: z.string().optional(),
 }),
 generateOutline: z.object({
 premise: z.string().min(1),
 }),
 createVolume: z.object({
 title: z.string().min(1),
 thesis: z.string().optional(),
 arcBeats: z.array(z.any()).optional(),
 }),
 createBibleEntry: z.object({
 kind: z.enum(['location','item','concept','magic','faction','rule']),
 name: z.string().min(1),
 description: z.string().optional(),
 rules: z.string().optional(),
 }),
 createCharacter: z.object({
 name: z.string().min(1),
 tier: z.enum(['principal','recurring','walk_on']).default('recurring'),
 publicRole: z.string().optional(),
 secretMotive: z.string().optional(),
 voiceMd: z.string().optional(),
 }),
 updateCharacter: z.object({
 name: z.string().optional(),
 publicRole: z.string().optional(),
 secretMotive: z.string().optional(),
 voiceMd: z.string().optional(),
 tier: z.enum(['principal','recurring','walk_on']).optional(),
 }),
 createFaction: z.object({
 name: z.string().min(1),
 description: z.string().optional(),
 }),
 patchIssue: z.object({
 status: z.enum(['open','in_progress','resolved','dismissed','auto_fixed']).optional(),
 }),
 exportProject: z.object({
 format: z.enum(['md','epub']).default('md'),
 }),
 worldTick: z.object({}).passthrough(),
 createSimulation: z.object({
 projectId: z.string().uuid(),
 directorGoal: z.string().min(1),
 characterIds: z.array(z.string()).min(2),
 sceneSetup: z.string().optional(),
 sceneAtmosphere: z.string().optional(),
 timeContext: z.string().optional(),
 maxTurns: z.number().min(2).max(40).optional(),
 chapterId: z.string().optional(),
 }),
 generateChapter: z.object({
 projectId: z.string().uuid(),
 outline: z.string(),
 }).passthrough(),
 saveChapter: z.object({
 contentMd: z.string().min(1),
 source: z.enum(['initial','rewrite','simulation_inserted','manual','merge','auto_fix']).default('manual'),
 versionLabel: z.string().optional(),
 }),
 rewriteSection: z.object({
 projectId: z.string().uuid(),
 section: z.string().min(1),
 instruction: z.string().min(1),
 context: z.string().optional(),
 }),
 reviewChapter: z.object({}).passthrough(),
 finalizeChapter: z.object({}).passthrough(),
 summarizeChapter: z.object({}).passthrough(),
 switchVersion: z.object({
 versionId: z.string().uuid(),
 }),
} as const

export type SchemaName = keyof typeof schemas

export function validate<T extends SchemaName>(
 name: T,
 body: unknown
): { ok: true; data: z.infer<typeof schemas[T]> } | { ok: false; error: any } {
 const result = schemas[name].safeParse(body)
 if (result.success) return { ok: true, data: result.data as any }
 return { ok: false, error: result.error.flatten() }
}
