// lib/prompts.ts - DEPRECATED
// 自 TASK-3 起，所有 chapter 相关 agent 的 prompt 都已迁移到
// prompts/agents/*.md 并由 Mastra agent 直接加载。
// 此文件中的 loadPrompt/renderPrompt 不再被调用。
// 保留文件仅用于向后兼容，新代码请勿使用。

import { readFileSync } from 'fs'
import { join } from 'path'

const PROMPTS_DIR = join(process.cwd(), 'prompts')

/** @deprecated Mastra agent 自己加载 prompt，不要用这个 */
export function readPromptSync(relativePath: string): string {
  const fullPath = join(PROMPTS_DIR, relativePath)
  try {
    return readFileSync(fullPath, 'utf-8')
  } catch {
    return ''
  }
}

/** @deprecated */
export function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) {
    return { frontmatter: {}, body: content }
  }

  const frontmatterStr = match[1]
  const body = match[2]

  const frontmatter: Record<string, string> = {}
  for (const line of frontmatterStr.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim()
      const value = line.slice(colonIdx + 1).trim()
      frontmatter[key] = value
    }
  }

  return { frontmatter, body }
}

/** @deprecated */
export function renderPrompt(template: string, vars: Record<string, string>): string {
  let rendered = template
  for (const [key, value] of Object.entries(vars)) {
    rendered = rendered.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value || '')
  }
  rendered = rendered.replace(/\{\{\s*\w+\s*\}\}/g, '')
  return rendered
}

/** @deprecated Mastra agent 自己加载 prompt，不要用这个 */
export function loadPrompt(relativePath: string, vars: Record<string, string> = {}): string {
  const raw = readPromptSync(relativePath)
  if (!raw) return ''

  const { body } = parseFrontmatter(raw)
  return renderPrompt(body, vars)
}

/** @deprecated */
export function loadPromptWithMeta(relativePath: string, vars: Record<string, string> = {}): {
  instructions: string
  meta: Record<string, string>
} {
  const raw = readPromptSync(relativePath)
  if (!raw) return { instructions: '', meta: {} }

  const { frontmatter, body } = parseFrontmatter(raw)
  return {
    instructions: renderPrompt(body, vars),
    meta: frontmatter,
  }
}