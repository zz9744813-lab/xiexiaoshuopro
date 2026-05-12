// lib/embed.ts - OpenAI embedding wrapper for semantic search
import { logger } from '@/lib/logger'

const EMBED_MODEL = 'text-embedding-3-small'
const EMBED_DIMENSIONS = 1536

interface EmbedConfig {
  model?: string
  apiKey?: string
  baseURL?: string
}

let config: EmbedConfig = {}

export function configureEmbed(cfg: EmbedConfig) {
  config = { ...config, ...cfg }
}

/**
 * Generate a single embedding vector for a text.
 * Uses OpenAI-compatible API.
 */
export async function embed(text: string): Promise<number[]> {
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY
  const baseURL = config.baseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

  if (!apiKey) {
    logger.warn('No OpenAI API key configured for embeddings')
    return []
  }

  const response = await fetch(`${baseURL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || EMBED_MODEL,
      input: text,
      dimensions: EMBED_DIMENSIONS,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    logger.error('Embedding API error', { status: response.status, error: err })
    throw new Error(`Embedding API error: ${response.status}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

/**
 * Generate embeddings for multiple texts in batch.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY
  const baseURL = config.baseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

  if (!apiKey) {
    logger.warn('No OpenAI API key configured for embeddings')
    return texts.map(() => [])
  }

  const response = await fetch(`${baseURL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || EMBED_MODEL,
      input: texts,
      dimensions: EMBED_DIMENSIONS,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    logger.error('Embedding batch API error', { status: response.status, error: err })
    throw new Error(`Embedding batch API error: ${response.status}`)
  }

  const data = await response.json()
  return data.data.map((d: { embedding: number[] }) => d.embedding)
}

/**
 * Cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
