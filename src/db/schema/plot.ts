// src/db/schema/plot.ts - 伏笔和情节线索相关表
import { pgTable, uuid, text, integer, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { projects } from './project'
import { chapters } from './generation'
import { vector } from './_pgvector'

// 伏笔状态枚举
export const foreshadowingStatusEnum = pgEnum('foreshadowing_status', [
 'planted',
 'hinted',
 'reinforced',
 'resolved',
 'abandoned',
])

// 伏笔类型枚举
export const foreshadowingKindEnum = pgEnum('foreshadowing_kind', [
 'mystery',
 'setup',
 'character_arc',
 'symbol',
 'prop',
 'prophecy',
 'debt',
])

// 伏笔主表
export const foreshadowings = pgTable('foreshadowings', {
 id: uuid('id').primaryKey().defaultRandom(),
 projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
 plantedChannelId: uuid('planted_chapter_id').references(() => chapters.id),
 description: text('description').notNull(),
 type: text('type'),
 importance: integer('importance').default(5),
 payoffType: text('payoff_type'),
 status: foreshadowingStatusEnum('status').default('planted'),
 plantedAt: timestamp('planted_at'),
 resolvedChannelId: uuid('resolved_chapter_id').references(() => chapters.id),
 resolvedAt: timestamp('resolved_at'),
 payoffQuality: integer('payoff_quality'),
 linkedForeshadowingIds: uuid('linked_foreshadowing_ids').array(),
 embedding: vector('embedding'),
 createdAt: timestamp('created_at').defaultNow().notNull(),
 updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// 伏笔检查事件表
export const foreshadowingChecks = pgTable('foreshadowing_checks', {
 id: uuid('id').primaryKey().defaultRandom(),
 projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
 currentChapterId: uuid('current_chapter_id').references(() => chapters.id),
 findings: jsonb('findings'),
 checkedAt: timestamp('checked_at').defaultNow().notNull(),
 createdByAgent: text('created_by_agent'),
})

export type Foreshadowing = typeof foreshadowings.$inferSelect
export type ForeshadowingCheck = typeof foreshadowingChecks.$inferSelect
