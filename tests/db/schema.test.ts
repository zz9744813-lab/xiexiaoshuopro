// tests/db/schema.test.ts - 数据库 Schema 完整性测试
import { describe, it, expect } from 'vitest'
import * as schema from '@/db/schema'

describe('Database Schema', () => {
  it('所有核心表已定义', () => {
    // Project 模块
    expect(schema.projects).toBeDefined()
    expect(schema.projectSettings).toBeDefined()

    // Outline 模块
    expect(schema.volumes).toBeDefined()
    expect(schema.chapterOutlines).toBeDefined()
    expect(schema.sceneMarkers).toBeDefined()

    // Generation 模块
    expect(schema.chapters).toBeDefined()
    expect(schema.chapterVersions).toBeDefined()
    expect(schema.chapterSummaries).toBeDefined()

    // Character 模块
    expect(schema.characters).toBeDefined()
    expect(schema.characterKnowledge).toBeDefined()
    expect(schema.characterRelationships).toBeDefined()
    expect(schema.characterEpisodicMemory).toBeDefined()

    // World 模块
    expect(schema.canonFacts).toBeDefined()
    expect(schema.worldEntries).toBeDefined()

    // Simulation 模块
    expect(schema.simulations).toBeDefined()
    expect(schema.simulationTurns).toBeDefined()
    expect(schema.simulationScripts).toBeDefined()
    expect(schema.simulationCharacterStates).toBeDefined()

    // Review 模块
    expect(schema.issues).toBeDefined()

    // Time 模块
    expect(schema.worldClock).toBeDefined()
    expect(schema.betweenChapterEvents).toBeDefined()
    expect(schema.factionMovements).toBeDefined()

    // Version 模块
    expect(schema.versionDependencies).toBeDefined()
    expect(schema.versionBranches).toBeDefined()

    // Style 模块
    expect(schema.voiceCards).toBeDefined()
    expect(schema.styleFingerprints).toBeDefined()

    // Observability 模块
    expect(schema.jobs).toBeDefined()
    expect(schema.llmCalls).toBeDefined()

    // Prompt 模块
    expect(schema.prompts).toBeDefined()
    expect(schema.promptRuns).toBeDefined()

    // Export 模块
    expect(schema.exports).toBeDefined()
  })

  it('枚举类型已定义', () => {
    expect(schema.safetyLevelEnum).toBeDefined()
    expect(schema.volumeStatusEnum).toBeDefined()
    expect(schema.chapterOutlineStatusEnum).toBeDefined()
    expect(schema.chapterVersionSourceEnum).toBeDefined()
    expect(schema.sceneTypeEnum).toBeDefined()
    expect(schema.characterTierEnum).toBeDefined()
    expect(schema.issueSeverityEnum).toBeDefined()
    expect(schema.issueStatusEnum).toBeDefined()
    expect(schema.jobStatusEnum).toBeDefined()
    expect(schema.simulationStatusEnum).toBeDefined()
    expect(schema.simulationTurnSpeakerEnum).toBeDefined()
  })

  it('表数量 >= 25', () => {
    const tableNames = Object.keys(schema).filter(
      key => !key.includes('Enum') && !key.startsWith('_')
        && typeof (schema as Record<string, unknown>)[key] === 'object'
        && (schema as Record<string, unknown>)[key] !== null
    )
    // 验证关键表存在即可
    expect(tableNames.length).toBeGreaterThanOrEqual(25)
  })
})
