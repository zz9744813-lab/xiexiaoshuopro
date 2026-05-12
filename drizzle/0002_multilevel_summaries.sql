-- drizzle/0002_multilevel_summaries.sql
CREATE TYPE IF NOT EXISTS summary_level AS ENUM ('chapter', 'volume', 'book');

CREATE TABLE IF NOT EXISTS multi_level_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  level summary_level NOT NULL,
  parent_id UUID REFERENCES multi_level_summaries(id),
  title TEXT NOT NULL,
  short_summary TEXT,
  long_summary TEXT,
  key_events JSONB DEFAULT '[]',
  emotional_arc TEXT,
  reader_questions JSONB DEFAULT '[]',
  embedding vector(1024),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mls_embedding ON multi_level_summaries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
