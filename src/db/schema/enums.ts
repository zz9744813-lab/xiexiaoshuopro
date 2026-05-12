import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
  uuid,
  numeric,
} from 'drizzle-orm/pg-core'

// ============ Enums ============

export const safetyLevelEnum = pgEnum('safety_level', ['strict', 'normal', 'unrestricted'])
export const volumeStatusEnum = pgEnum('volume_status', ['planning', 'writing', 'reviewing', 'done'])
export const chapterOutlineStatusEnum = pgEnum('chapter_outline_status', [
  'outline', 'drafting', 'drafted', 'reviewed', 'finalized', 'locked'
])
export const chapterVersionSourceEnum = pgEnum('chapter_version_source', [
  'initial', 'rewrite', 'simulation_inserted', 'manual', 'merge', 'auto_fix'
])
export const sceneTypeEnum = pgEnum('scene_type', [
  'dialogue', 'action', 'description', 'montage', 'interlude', 'simulation'
])
export const characterTierEnum = pgEnum('character_tier', ['principal', 'recurring', 'walk_on'])
export const issueSeverityEnum = pgEnum('issue_severity', ['critical', 'warning', 'info'])
export const issueStatusEnum = pgEnum('issue_status', [
  'open', 'in_progress', 'resolved', 'dismissed', 'auto_fixed', 'wont_fix'
])
export const jobStatusEnum = pgEnum('job_status', [
  'pending', 'running', 'completed', 'failed', 'cancelled'
])
