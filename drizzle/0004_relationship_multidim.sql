-- drizzle/0004_relationship_multidim.sql
ALTER TABLE character_relationships ADD COLUMN IF NOT EXISTS warmth_snapshots JSONB DEFAULT '[]';
ALTER TABLE character_relationships ADD COLUMN IF NOT EXISTS trust_snapshots JSONB DEFAULT '[]';
ALTER TABLE character_relationships ADD COLUMN IF NOT EXISTS rivalry REAL DEFAULT 0;
ALTER TABLE character_relationships ADD COLUMN IF NOT EXISTS dependency REAL DEFAULT 0;
ALTER TABLE character_relationships ADD COLUMN IF NOT EXISTS attraction REAL DEFAULT 0;
ALTER TABLE character_relationships ADD COLUMN IF NOT EXISTS respect REAL DEFAULT 0;

CREATE TABLE IF NOT EXISTS relationship_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID REFERENCES character_relationships(id) ON DELETE CASCADE,
  warmth REAL,
  trust REAL,
  rivalry REAL,
  dependency REAL,
  attraction REAL,
  respect REAL,
  source_chapter_id UUID REFERENCES chapters(id),
  source_simulation_id UUID,
  note TEXT,
  taken_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rs_relationship ON relationship_snapshots(relationship_id, taken_at DESC);
