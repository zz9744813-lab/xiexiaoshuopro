// src/lib/chunk.ts
export interface ChunkOptions {
  targetSize?: number
  overlap?: number
}

export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const target = opts.targetSize ?? 800
  const overlap = opts.overlap ?? 100
  const paragraphs = text.split(/\n\n+/)
  const chunks: string[] = []
  let current = ''

  for (const p of paragraphs) {
    if (current.length + p.length + 2 <= target) {
      current = current ? current + '\n\n' + p : p
    } else {
      if (current) {
        chunks.push(current)
        const lastSentences = current.split(/(?<=[。！？!?])/).slice(-2).join('')
        current = (lastSentences.length < overlap ? lastSentences : '') + (current ? '\n\n' : '') + p
      } else {
        for (let i = 0; i < p.length; i += target) {
          chunks.push(p.slice(i, i + target))
        }
      }
    }
  }
  if (current) chunks.push(current)
  return chunks
}
