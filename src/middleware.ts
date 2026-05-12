// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface SecurityConfig {
  whitelist: { paths: string[]; methods: string[] }
  blacklist: { paths: string[]; ipPrefixes: string[]; rateLimit: { windowMs: number; maxRequests: number } }
  circuit_breaker: { enabled: boolean; maxLlmCallsPerMinute: number; maxTokensPerMinute: number; maxCostPerHour: number; cooldownMinutes: number; alertEmail: string }
}

let configCache: SecurityConfig | null = null
function getConfig(): SecurityConfig {
  if (configCache) return configCache
  const raw = fs.readFileSync(path.resolve(process.cwd(), 'config/hermes-security.json'), 'utf-8')
  configCache = JSON.parse(raw)
  return configCache!
}

const requestCounts = new Map<string, { count: number; resetAt: number }>()

export async function middleware(request: NextRequest) {
  const config = getConfig()
  const { pathname } = request.nextUrl
  const method = request.method
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

  // 1. Blacklist check
  for (const bp of config.blacklist.paths) {
    if (pathname.startsWith(bp)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }
  for (const prefix of config.blacklist.ipPrefixes) {
    if (ip.startsWith(prefix)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  // 2. Whitelist check
  let allowed = false
  for (const wp of config.whitelist.paths) {
    const pattern = wp.replace(/:\w+/g, '[^/]+')
    if (new RegExp(`^${pattern}`).test(pathname) && config.whitelist.methods.includes(method)) {
      allowed = true
      break
    }
  }
  // Always allow health check
  if (pathname === '/api/health') allowed = true
  // Allow Next.js internals
  if (pathname.startsWith('/_next/') || pathname.startsWith('/favicon')) allowed = true

  if (!allowed) {
    return NextResponse.json({ error: 'method not allowed' }, { status: 405 })
  }

  // 3. Rate limit
  const now = Date.now()
  const key = `${ip}:${pathname}`
  const entry = requestCounts.get(key)
  if (entry && now < entry.resetAt && entry.count >= config.blacklist.rateLimit.maxRequests) {
    return NextResponse.json({ error: 'rate limit exceeded' }, { status: 429 })
  }
  if (!entry || now >= entry.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + config.blacklist.rateLimit.windowMs })
  } else {
    entry.count++
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
