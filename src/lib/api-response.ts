/**
 * Standard API response helpers.
 */
import { NextResponse } from 'next/server';

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400, details?: unknown): NextResponse {
  return NextResponse.json(
    { ok: false, error: { message, details } },
    { status },
  );
}

export function badRequest(message: string, details?: unknown): NextResponse {
  return fail(message, 400, details);
}

export function notFound(message = 'Not found'): NextResponse {
  return fail(message, 404);
}

export function serverError(message = 'Internal server error', details?: unknown): NextResponse {
  return fail(message, 500, details);
}
