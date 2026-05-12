-- 0001_pgvector.sql - Enable pgvector extension and add embedding columns
-- Run: psql $DATABASE_URL -f drizzle/0001_pgvector.sql

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to world_entries for semantic search
ALTER TABLE world_entries ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add embedding column to canon_facts for semantic search
ALTER TABLE canon_facts ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create IVFFlat index for approximate nearest neighbor search on world_entries
-- (requires data first; uncomment after seeding some embeddings)
-- CREATE INDEX IF NOT EXISTS idx_world_entries_embedding
--   ON world_entries USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- Create IVFFlat index for canon_facts
-- CREATE INDEX IF NOT EXISTS idx_canon_facts_embedding
--   ON canon_facts USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);
