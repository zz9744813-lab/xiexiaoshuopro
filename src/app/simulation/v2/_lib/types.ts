export interface World {
  id: string;
  name: string;
  defaultWorldlineId?: string | null;
}

export interface Entity {
  id: string;
  name: string;
  entityType: string;
  apiProfileId?: string | null;
}

export interface ApiProfile {
  id: string;
  name: string;
  model: string;
  temperature?: string | number | null;
  topP?: string | number | null;
  providerId: string;
}

export interface Scene {
  id: string;
  title?: string | null;
  status: string;
  participantEntityIds: string[];
  createdAt: string;
}

export interface Action {
  id: string;
  entityId: string;
  roundId: string;
  publicLayer: Record<string, unknown>;
  privateLayer: Record<string, unknown>;
  isFallback: boolean;
  createdAt?: string;
}

export interface Round {
  id: string;
  roundIndex: number;
  status: string;
  mode: string;
  sceneId?: string;
  createdAt?: string;
}

export interface SimEvent {
  id: string;
  type: string;
  ts: number;
  data?: unknown;
}

export interface SimulationRun {
  id: string;
  sceneId: string;
  status: string;
  mode: string;
  maxRounds: number | null;
  maxCostUsd: string | null;
  roundDelayMs: number;
  stagnationThreshold: number | null;
  totalRounds: number;
  totalCostUsd: string;
  consecutiveEmptyRounds: number;
  stopReason: string | null;
  errorMessage: string | null;
  startedAt: string;
  endedAt: string | null;
  liveCostUsd?: number;
}
