// lib/api/rate-limit.ts - 速率限制
import { LRUCache } from 'lru-cache'
import { logger } from '@/lib/logger'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

interface RateLimitInfo {
  count: number
  resetTime: number
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1分钟
  maxRequests: 60,     // 60次/分钟
}

// 简单的内存存储（生产环境应使用 Redis）
const cache = new LRUCache<string, RateLimitInfo>({
  max: 10000,
  ttl: 60 * 60 * 1000, // 1小时
})

export class RateLimiter {
  private config: RateLimitConfig

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  check(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now()
    const info = cache.get(key)

    if (!info || now > info.resetTime) {
      // 新窗口
      const newInfo: RateLimitInfo = {
        count: 1,
        resetTime: now + this.config.windowMs,
      }
      cache.set(key, newInfo)
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime: newInfo.resetTime,
      }
    }

    if (info.count >= this.config.maxRequests) {
      // 超出限制
      logger.warn('Rate limit exceeded', { key, count: info.count })
      return {
        allowed: false,
        remaining: 0,
        resetTime: info.resetTime,
      }
    }

    // 增加计数
    info.count++
    return {
      allowed: true,
      remaining: this.config.maxRequests - info.count,
      resetTime: info.resetTime,
    }
  }

  reset(key: string): void {
    cache.delete(key)
  }
}

// 预定义的限流配置
export const rateLimits = {
  // 生成类API（更严格）
  generate: new RateLimiter({ windowMs: 60 * 1000, maxRequests: 5 }),
  // 普通API
  default: new RateLimiter({ windowMs: 60 * 1000, maxRequests: 60 }),
  // 宽松API
  relaxed: new RateLimiter({ windowMs: 60 * 1000, maxRequests: 120 }),
}

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return 'unknown'
}
