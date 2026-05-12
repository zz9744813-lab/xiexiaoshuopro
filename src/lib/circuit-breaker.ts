// src/lib/circuit-breaker.ts
import fs from 'fs'
import path from 'path'

interface BreakerState {
  totalCalls: number
  totalTokens: number
  totalCost: number
  lastReset: number
  isOpen: boolean
  openedAt: number | null
}

const state: BreakerState = {
  totalCalls: 0,
  totalTokens: 0,
  totalCost: 0,
  lastReset: Date.now(),
  isOpen: false,
  openedAt: null,
}

function getConfig() {
  const raw = fs.readFileSync(path.resolve(process.cwd(), 'config/hermes-security.json'), 'utf-8')
  return JSON.parse(raw).circuit_breaker
}

const HOURLY_MS = 3600000

export function checkCircuitBreaker(): boolean {
  const config = getConfig()
  if (!config.enabled) return true

  const now = Date.now()
  if (now - state.lastReset > HOURLY_MS) {
    state.totalCalls = 0
    state.totalTokens = 0
    state.totalCost = 0
    state.lastReset = now
    if (state.isOpen && now - (state.openedAt || 0) > config.cooldownMinutes * 60000) {
      state.isOpen = false
    }
  }

  if (state.isOpen) return false

  if (state.totalCalls >= config.maxLlmCallsPerMinute * 60
      || state.totalTokens >= config.maxTokensPerMinute * 60
      || state.totalCost >= config.maxCostPerHour) {
    state.isOpen = true
    state.openedAt = now
    console.error(`[CIRCUIT BREAKER] OPEN — calls:${state.totalCalls} tokens:${state.totalTokens} cost:$${state.totalCost.toFixed(2)}`)
    // TODO: send alert email to ${config.alertEmail}
    return false
  }

  return true
}

export function recordLlmCall(tokensIn: number, tokensOut: number, costUsd: number) {
  state.totalCalls++
  state.totalTokens += tokensIn + tokensOut
  state.totalCost += costUsd
}

export function getBreakerStatus() {
  return { ...state }
}
