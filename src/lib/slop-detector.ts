// lib/slop-detector.ts - AI 味检测器
import slopDictionary from '../../prompts/slop_dictionaries/chinese_general.json'

export interface SlopHit {
  pattern: string;
  category: string;
  replacement: string;
  position: number;
  context: string; // 命中位置前后 30 字
}

/**
 * 检测文本中的 AI 味表达
 */
export function detectSlop(text: string): SlopHit[] {
  const hits: SlopHit[] = [];

  for (const entry of slopDictionary.patterns) {
    const { pattern, category, replacement } = entry;
    const isRegex = 'is_regex' in entry && entry.is_regex;

    if (isRegex) {
      const regex = new RegExp(pattern, 'g');
      let match;
      while ((match = regex.exec(text)) !== null) {
        const pos = match.index;
        const start = Math.max(0, pos - 30);
        const end = Math.min(text.length, pos + match[0].length + 30);
        hits.push({
          pattern: match[0],
          category,
          replacement,
          position: pos,
          context: text.slice(start, end),
        });
      }
    } else {
      let searchFrom = 0;
      while (true) {
        const pos = text.indexOf(pattern, searchFrom);
        if (pos === -1) break;
        const start = Math.max(0, pos - 30);
        const end = Math.min(text.length, pos + pattern.length + 30);
        hits.push({
          pattern,
          category,
          replacement,
          position: pos,
          context: text.slice(start, end),
        });
        searchFrom = pos + pattern.length;
      }
    }
  }

  return hits.sort((a, b) => a.position - b.position);
}

/**
 * 计算 AI 味命中率
 */
export function slopRate(text: string): number {
  const hits = detectSlop(text);
  const wordCount = text.length;
  if (wordCount === 0) return 0;
  return hits.length / wordCount;
}
