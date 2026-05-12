// tests/build.test.ts
import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'

describe('Type check', () => {
  it('tsc --noEmit 通过', () => {
    let out = ''
    try {
      out = execSync('npx tsc --noEmit', { encoding: 'utf-8', stdio: ['ignore','pipe','pipe'] })
    } catch (e: any) {
      out = (e.stdout?.toString() || '') + (e.stderr?.toString() || '')
    }
    const errors = out.split('\n').filter((l: string) => /error TS/.test(l))
    expect(errors).toEqual([])
  }, 120000)
})
