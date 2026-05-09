// lib/prompts.ts - Prompt 读取工具
import { readFileSync } from 'fs'
import { join } from 'path'

const PROMPTS_DIR = join(process.cwd(), 'prompts')

/**
 * 同步读取 prompt 文件
 * @param relativePath - 相对于 prompts/ 目录的路径，如 'agents/chapter-draft.md'
 */
export function readPromptSync(relativePath: string): string {
  const fullPath = join(PROMPTS_DIR, relativePath)
  try {
    return readFileSync(fullPath, 'utf-8')
  } catch {
    console.warn(`[prompts] 未找到 prompt 文件: ${fullPath}`)
    return ''
  }
}

/**
 * 渲染 prompt 模板，替换 {{ variable }} 占位符
 */
export function renderPrompt(template: string, vars: Record<string, string>): string {
  let rendered = template
  for (const [key, value] of Object.entries(vars)) {
    rendered = rendered.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value)
  }
  return rendered
}

/**
 * 解析 prompt frontmatter (YAML-like)
 */
export function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) {
    return { frontmatter: {}, body: content }
  }

  const frontmatterStr = match[1]
  const body = match[2]

  const frontmatter: Record<string, unknown> = {}
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
