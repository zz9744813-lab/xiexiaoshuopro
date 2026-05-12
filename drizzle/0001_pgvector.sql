-- 0001_pgvector.sql - Enable pgvector extension and add embedding columns
-- Run: psql $DATABASE_URL -f drizzle/0001_pgvector.sql

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to world_entries for semantic search
ALTER TABLE world_entries ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- Add embedding column to canon_facts for semantic search
ALTER TABLE canon_facts ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- Create IVFFlat index for approximate nearest neighbor search on world_entries
-- (requires data first; uncomment after seeding some embeddings)
CREATE INDEX IF NOT EXISTS idx_world_entries_embedding
--   ON world_entries USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- Create IVFFlat index for canon_facts
CREATE INDEX IF NOT EXISTS idx_canon_facts_embedding
--   ON canon_facts USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- PATCH-3: Add embedding to 3 more tables
ALTER TABLE characters ADD COLUMN IF NOT EXISTS embedding vector(1024);
ALTER TABLE character_episodic_memory ADD COLUMN IF NOT EXISTS embedding vector(1024);
ALTER TABLE chapter_summaries ADD COLUMN IF NOT EXISTS embedding vector(1024);
ALTER TABLE chapter_chunks ADD COLUMN IF NOT EXISTS embedding vector(1024);

CREATE INDEX IF NOT EXISTS idx_characters_embedding ON characters USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX IF NOT EXISTS idx_character_episodic_embedding ON character_episodic_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_chapter_summaries_embedding ON chapter_summaries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX IF NOT EXISTS idx_chapter_chunks_embedding ON chapter_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 200);
