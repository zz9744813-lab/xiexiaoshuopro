// types/index.ts - 核心类型定义

export interface AgentContext {
  projectId: string
  volumeId?: string
  chapterId?: string
  characterId?: string
  userId: string
  jobId: string
  parentJobId?: string
}

export type CharacterTier = 'principal' | 'recurring' | 'walk_on'
export type ChapterStatus = 'outline' | 'drafting' | 'drafted' | 'reviewed' | 'finalized' | 'locked'
export type VolumeStatus = 'planning' | 'writing' | 'reviewing' | 'done'
export type IssueSeverity = 'critical' | 'warning' | 'info'
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed' | 'auto_fixed' | 'wont_fix'
export type SafetyLevel = 'strict' | 'normal' | 'unrestricted'

export interface IssueAxis {
  type: 'logic' | 'voice' | 'canon' | 'pacing' | 'theme' | 'genre' | 'reader' | 'aislop' | 'character_promotion' | 'relationship' | 'continuity'
}

export interface CharacterPrivateView {
  id: string
  name: string
  appearance: string
  publicRole: string
  secretMotive: string
  trueIntent: string
  knowledge: {
    facts: string[]
    suspected: string[]
    lies: string[]
  }
  currentEmotionalState: string
  voiceMd: string
}

export interface CharacterPublicView {
  id: string
  name: string
  appearance: string
  publicRole: string
  observableBehaviorHistory: string[]
}

export interface SimulationTurn {
  idx: number
  speakerType: 'director' | 'character' | 'narrator' | 'injection'
  speakerId: string
  utterance: string
  reasoning?: string
  visibleTo: string[]
  timestamp: Date
}

export interface SSEEvent {
  type: 'token' | 'tool_call' | 'tool_result' | 'done' | 'error' | 'meta'
  data: unknown
  jobId: string
  timestamp: number
}
