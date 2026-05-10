// lib/api/errors.ts - API 错误处理
import { logger } from '@/lib/logger'

export class APIError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message)
    this.name = 'APIError'
  }
}

export class ValidationError extends APIError {
  constructor(message: string, public details?: Record<string, string>) {
    super(message, 400, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends APIError {
  constructor(resource: string, id?: string) {
    super(`${resource}${id ? ` (ID: ${id})` : ''} not found`, 404, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

export class RateLimitError extends APIError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED')
    this.name = 'RateLimitError'
  }
}

export class UnauthorizedError extends APIError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED')
    this.name = 'UnauthorizedError'
  }
}

export function handleAPIError(error: unknown): Response {
  if (error instanceof APIError) {
    logger.warn(`API Error: ${error.code}`, { message: error.message, status: error.statusCode })
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    )
  }

  const message = error instanceof Error ? error.message : 'Unknown error'
  logger.error('Unhandled API error', { error: message })
  return Response.json(
    { error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 }
  )
}
