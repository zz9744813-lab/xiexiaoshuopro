// lib/logger.ts - 结构化日志
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  [key: string]: unknown
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const currentLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

function formatEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify(entry)
  }
  // 开发环境可读格式
  const { level, message, timestamp, ...rest } = entry
  const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : ''
  return `[${timestamp}] ${level.toUpperCase()} ${message}${extra}`
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (!shouldLog(level)) return
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  }
  const output = formatEntry(entry)
  if (level === 'error') {
    console.error(output)
  } else if (level === 'warn') {
    console.warn(output)
  } else {
    console.log(output)
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
}
