// app/api/health/route.ts - 健康检查端点
import { NextResponse } from 'next/server'
import { getPoolStatus } from '@/db'
import { logger } from '@/lib/logger'

export async function GET() {
  const checks: Record<string, { status: 'ok' | 'error'; latency: number; message?: string }> = {}
  let allHealthy = true

  // 数据库检查
  const dbStart = Date.now()
  try {
    const poolStatus = getPoolStatus()
    checks.database = {
      status: 'ok',
      latency: Date.now() - dbStart,
      message: `pool: ${poolStatus.total} total, ${poolStatus.idle} idle`,
    }
  } catch (err) {
    allHealthy = false
    checks.database = {
      status: 'error',
      latency: Date.now() - dbStart,
      message: err instanceof Error ? err.message : 'Unknown error',
    }
  }

  // 内存检查
  const memUsage = process.memoryUsage()
  const memMB = Math.round(memUsage.heapUsed / 1024 / 1024)
  checks.memory = {
    status: memMB > 512 ? 'error' : 'ok',
    latency: 0,
    message: `${memMB}MB used`,
  }
  if (memMB > 512) allHealthy = false

  // 正常运行时间
  const uptime = Math.floor(process.uptime())

  const response = {
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime,
    version: process.env.npm_package_version || '0.1.0',
    checks,
  }

  logger.debug('Health check', { status: response.status, checks: Object.keys(checks) })

  return NextResponse.json(response, {
    status: allHealthy ? 200 : 503,
  })
}
