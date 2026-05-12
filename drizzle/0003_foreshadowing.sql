-- drizzle/0003_foreshadowing.sql
CREATE TABLE IF NOT EXISTS foreshadowings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  planted_chapter_id UUID REFERENCES chapters(id),
  description TEXT NOT NULL,
  planted_at TEXT,
  resolved_chapter_id UUID REFERENCES chapters(id),
  resolved_at TIMESTAMP,
  status TEXT DEFAULT 'planted' CHECK (status IN ('planted','hinted','reinforced','resolved','abandoned')),
  payoff_type TEXT,
  payoff_quality INTEGER CHECK (payoff_quality BETWEEN 0 AND 10),
  linked_foreshadowing_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_foreshadow_project ON foreshadowings(project_id);
CREATE INDEX IF NOT EXISTS idx_foreshadow_status ON foreshadowings(project_id, status);

CREATE TABLE IF NOT EXISTS foreshadowing_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  current_chapter_id UUID REFERENCES chapters(id),
  findings JSONB DEFAULT '[]',
  checked_at TIMESTAMP DEFAULT now(),
  created_by_agent TEXT
);
