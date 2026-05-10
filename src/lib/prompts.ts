// lib/prompts.ts - Prompt 读取和渲染工具
import { readFileSync } from 'fs'
import { join } from 'path'

const PROMPTS_DIR = join(process.cwd(), 'prompts')

/**
 * 同步读取 prompt 文件（原始内容）
 */
export function readPromptSync(relativePath: string): string {
  const fullPath = join(PROMPTS_DIR, relativePath)
  try {
    return readFileSync(fullPath, 'utf-8')
  } catch {
    return ''
  }
}

/**
 * 解析 prompt frontmatter (YAML-like)
 */
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

/**
 * 渲染 prompt 模板，替换 {{ variable }} 占位符
 */
export function renderPrompt(template: string, vars: Record<string, string>): string {
  let rendered = template
  for (const [key, value] of Object.entries(vars)) {
    rendered = rendered.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value || '')
  }
  // 清理未匹配的占位符（避免 LLM 看到 {{ xxx }}）
  rendered = rendered.replace(/\{\{\s*\w+\s*\}\}/g, '')
  return rendered
}

/**
 * 一站式加载 prompt：读文件 + 剥离 frontmatter + 渲染变量
 * 这是 agent 应该使用的唯一入口
 */
export function loadPrompt(relativePath: string, vars: Record<string, string> = {}): string {
  const raw = readPromptSync(relativePath)
  if (!raw) return ''

  const { body } = parseFrontmatter(raw)
  return renderPrompt(body, vars)
}

/**
 * 加载 prompt 并返回 frontmatter 元数据（用于获取 temperature 等配置）
 */
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
