// lib/api/validation.ts - API 验证工具 (comprehensive schemas)
import { z, ZodError } from 'zod'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// ====== Validation Helpers ======

export function validateRequest<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: ZodError } {
  const result = schema.safeParse(data)
  if (!result.success) {
    return { success: false, error: result.error }
  }
  return { success: true, data: result.data }
}

export function formatZodError(error: ZodError): Record<string, string> {
  const formatted: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    formatted[path] = issue.message
  }
  return formatted
}

export function createValidationErrorResponse(error: ZodError): NextResponse {
  const formatted = formatZodError(error)
  logger.warn('API validation failed', { errors: formatted })
  return NextResponse.json(
    { error: 'Validation failed', details: formatted },
    { status: 400 }
  )
}

/**
 * validate() helper — parse body, return data or 400 response.
 * Usage: const parsed = await validate(request, schema); if (parsed instanceof NextResponse) return parsed;
 */
export async function validate<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<z.infer<T> | NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const result = schema.safeParse(body)
  if (!result.success) {
    logger.warn('Validation failed', { issues: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) })
    return NextResponse.json(
      { error: 'Validation failed', details: formatZodError(result.error) },
      { status: 400 }
    )
  }
  return result.data
}

// ====== Common Schemas ======

export const idParamSchema = z.object({
  id: z.string().uuid(),
})

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// ====== Project Schemas ======

export const createProjectSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200),
  genre: z.string().min(1, '类型不能为空').max(100),
  seed: z.string().optional().describe('初始种子/灵感'),
  authorNotes: z.string().optional(),
  voiceMd: z.string().optional(),
  safetyLevel: z.enum(['safe', 'normal', 'mature']).default('normal'),
  genreConfig: z.record(z.unknown()).optional(),
  modelRouting: z.record(z.unknown()).optional(),
})

export const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  genre: z.string().min(1).max(100).optional(),
  voiceMd: z.string().optional(),
  authorNotes: z.string().optional(),
  safetyLevel: z.enum(['safe', 'normal', 'mature']).optional(),
  genreConfig: z.record(z.unknown()).optional(),
  modelRouting: z.record(z.unknown()).optional(),
})

// ====== Volume Schemas ======

export const createVolumeSchema = z.object({
  title: z.string().min(1, '卷标题不能为空').max(200),
  thesis: z.string().optional(),
  arcBeats: z.array(z.string()).optional().describe('剧情节拍列表'),
})

// ====== Character Schemas ======

export const createCharacterSchema = z.object({
  name: z.string().min(1, '角色名称为必填项').max(100),
  tier: z.enum(['protagonist', 'major', 'supporting', 'walk_on']).default('walk_on'),
  appearance: z.string().optional(),
  publicRole: z.string().optional(),
  voiceMd: z.string().optional(),
  secretMotive: z.string().optional(),
  trueIntent: z.string().optional(),
  arcGoal: z.string().optional(),
})

export const updateCharacterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  tier: z.enum(['protagonist', 'major', 'supporting', 'walk_on']).optional(),
  appearance: z.string().optional(),
  publicRole: z.string().optional(),
  voiceMd: z.string().optional(),
  secretMotive: z.string().optional(),
  trueIntent: z.string().optional(),
  arcGoal: z.string().optional(),
  arcPosition: z.number().optional(),
  currentEmotionalState: z.string().optional(),
  alive: z.boolean().optional(),
})

// ====== Chapter Schemas ======

export const saveChapterSchema = z.object({
  contentMd: z.string().min(1, '内容不能为空'),
  source: z.enum(['initial', 'rewrite', 'edit', 'auto_fix']).default('initial'),
  versionLabel: z.string().optional(),
})

export const rewriteSectionSchema = z.object({
  projectId: z.string().uuid('无效的项目ID'),
  section: z.string().min(1, '待重写片段不能为空'),
  instruction: z.string().min(1, '重写指令不能为空'),
  context: z.string().optional(),
})

export const generateChapterSchema = z.object({
  projectId: z.string().uuid('无效的项目ID'),
  outline: z.string().min(1, '大纲不能为空'),
})

// ====== Outline Schemas ======

export const generateOutlineSchema = z.object({
  volumeId: z.string().uuid().optional(),
  arcBeats: z.array(z.string()).optional(),
  chapterCount: z.number().int().min(1).max(50).default(10),
})

// ====== Premise Schema ======

export const generatePremiseSchema = z.object({
  seed: z.string().optional(),
})

// ====== Faction / Bible / Issue Schemas ======

export const createFactionSchema = z.object({
  name: z.string().min(1, '名称为必填').max(200),
  description: z.string().optional(),
  ideology: z.string().optional(),
  powerLevel: z.number().int().min(0).optional(),
})

export const createBibleEntrySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('canon'),
    fact: z.string().min(1, 'fact 为必填'),
    category: z.string().optional(),
    immutable: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('world'),
    kind: z.string().min(1, 'kind 为必填'),
    name: z.string().min(1, 'name 为必填'),
    description: z.string().optional(),
    rules: z.string().optional(),
    parentId: z.string().uuid().optional(),
  }),
])

export const createIssueSchema = z.object({
  scope: z.enum(['chapter', 'volume', 'project', 'character']).default('chapter'),
  scopeId: z.string().optional(),
  axis: z.string().optional(),
  severity: z.enum(['info', 'warning', 'critical']).default('warning'),
  title: z.string().min(1, '标题不能为空'),
  description: z.string().optional(),
  evidence: z.string().optional(),
  proposedFix: z.string().optional(),
  reviewerAgent: z.string().optional(),
})

// ====== Simulation Schemas ======

export const createSimulationSchema = z.object({
  projectId: z.string().uuid('无效的项目ID'),
  sceneMarkerId: z.string().uuid().optional(),
  characterIds: z.array(z.string().uuid()).min(1, '至少需要一个角色'),
  directorGoal: z.string().min(1, 'directorGoal 为必填'),
  povChoice: z.string().optional(),
  maxTurns: z.number().int().min(1).max(500).default(90),
})

// ====== Export Schema ======

export const exportProjectSchema = z.object({
  format: z.enum(['md', 'epub', 'docx', 'pdf']).default('md'),
  scope: z.enum(['chapter', 'volume', 'full']).default('full'),
  scopeId: z.string().uuid().optional(),
})

// ====== World Tick Schema ======

export const worldTickSchema = z.object({
  afterChapterId: z.string().uuid().optional(),
  currentWorldDate: z.string().optional(),
})
