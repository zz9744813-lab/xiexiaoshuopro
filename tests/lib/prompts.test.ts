// tests/lib/prompts.test.ts - Prompt 工具测试
import { describe, it, expect } from 'vitest'
import { renderPrompt, parseFrontmatter } from '@/lib/prompts'

describe('Prompts', () => {
  it('renderPrompt 替换变量', () => {
    const template = '你好 {{ name }}，你的类型是 {{ genre }}。'
    const result = renderPrompt(template, { name: '李某', genre: '仙侠' })
    expect(result).toBe('你好 李某，你的类型是 仙侠。')
  })

  it('renderPrompt 处理多个同名变量', () => {
    const template = '{{ name }} 说了话。{{ name }} 又说了话。'
    const result = renderPrompt(template, { name: '王某' })
    expect(result).toBe('王某 说了话。王某 又说了话。')
  })

  it('renderPrompt 未提供的变量被清理（避免 LLM 看到占位符）', () => {
    const template = '{{ name }} 和 {{ unknown }}'
    const result = renderPrompt(template, { name: '张某' })
    expect(result).toBe('张某 和 ')
    expect(result).not.toContain('{{')
  })

  it('parseFrontmatter 解析正确', () => {
    const content = `---
name: test
version: 1
temperature: 0.85
---

# Body content here`

    const { frontmatter, body } = parseFrontmatter(content)
    expect(frontmatter.name).toBe('test')
    expect(frontmatter.version).toBe('1')
    expect(frontmatter.temperature).toBe('0.85')
    expect(body.trim()).toBe('# Body content here')
  })

  it('parseFrontmatter 无 frontmatter', () => {
    const content = '# Just a body\nNo frontmatter here.'
    const { frontmatter, body } = parseFrontmatter(content)
    expect(Object.keys(frontmatter).length).toBe(0)
    expect(body).toBe(content)
  })
})
