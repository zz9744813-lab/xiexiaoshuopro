// db/index.ts - 数据库连接（带连接池配置）
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
import { logger } from '@/lib/logger'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // 最大连接数
  idleTimeoutMillis: 30000,   // 空闲连接超时 30s
  connectionTimeoutMillis: 5000, // 连接超时 5s
})

// 连接池错误处理
pool.on('error', (err) => {
  logger.error('Unexpected pool error', { error: err.message })
})

// 连接池状态查询
export function getPoolStatus() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  }
}

export const db = drizzle(pool, { schema })
export { schema, pool }

// Pool shutdown hooks
if (process.env.NODE_ENV !== 'production') {
  process.on('SIGTERM', async () => {
    await pool.end()
    process.exit(0)
  })
}

process.on('beforeExit', async () => {
  await pool.end().catch(() => {})
})

export function getPoolStatus() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  }
}
