// lib/api/validation.ts - API 验证工具
import { z, ZodError } from 'zod'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

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
    {
      error: 'Validation failed',
      details: formatted,
    },
    { status: 400 }
  )
}

// 通用 ID 参数验证
export const idParamSchema = z.object({
  id: z.string().uuid(),
})

// 通用分页验证
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

// 通用排序验证
export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})
