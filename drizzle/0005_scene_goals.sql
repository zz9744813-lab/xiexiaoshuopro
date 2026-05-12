-- drizzle/0005_scene_goals.sql
ALTER TABLE simulation_character_states ADD COLUMN IF NOT EXISTS scene_goal TEXT;
ALTER TABLE simulation_character_states ADD COLUMN IF NOT EXISTS spatial_context TEXT;
ALTER TABLE simulation_character_states ADD COLUMN IF NOT EXISTS mood_tags TEXT[] DEFAULT '{}';
ALTER TABLE simulation_character_states ADD COLUMN IF NOT EXISTS available_actions JSONB DEFAULT '[]';
