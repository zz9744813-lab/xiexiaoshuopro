// db/queries/simulation.ts — 推演查询层
import { eq, asc, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  simulations,
  simulationTurns,
  simulationScripts,
  simulationCharacterStates,
} from "@/db/schema";

/** 创建推演 */
export async function createSimulation(input: {
  projectId: string;
  chapterId: string;
  scenario: string;
  participatingCharacterIds: string[];
}) {
  const [sim] = await db
    .insert(simulations)
    .values({
      projectId: input.projectId,
      chapterId: input.chapterId,
      scenario: input.scenario,
      participatingCharacterIds: input.participatingCharacterIds,
      status: "estimating",
    })
    .returning();
  return sim;
}

/** 追加推演回合 */
export async function appendTurn(input: {
  simulationId: string;
  speakerId: string;
  speakerRole: string;
  content: string;
  reasoning?: string;
  visibleTo: string[];
  turnIndex: number;
}) {
  const [turn] = await db
    .insert(simulationTurns)
    .values({
      simulationId: input.simulationId,
      speakerId: input.speakerId,
      speakerRole: input.speakerRole,
      content: input.content,
      reasoning: input.reasoning,
      visibleTo: input.visibleTo,
      turnIndex: input.turnIndex,
    })
    .returning();
  return turn;
}

/** 保存角色推演状态快照 */
export async function snapshotCharacterState(input: {
  simulationId: string;
  characterId: string;
  physicalState: string;
  emotionalState: string;
  currentGoal: string;
  knowledgeState?: any;
}) {
  const [state] = await db
    .insert(simulationCharacterStates)
    .values({
      simulationId: input.simulationId,
      characterId: input.characterId,
      physicalState: input.physicalState,
      emotionalState: input.emotionalState,
      currentGoal: input.currentGoal,
      knowledgeState: input.knowledgeState,
    })
    .returning();
  return state;
}

/** 获取推演的回合（按角色过滤可见性） */
export async function getTurnsForCharacter(simulationId: string, characterId: string) {
  return db
    .select()
    .from(simulationTurns)
    .where(eq(simulationTurns.simulationId, simulationId))
    .orderBy(asc(simulationTurns.turnIndex));
}

/** 获取推演剧本 */
export async function getSimulationScripts(simulationId: string) {
  return db
    .select()
    .from(simulationScripts)
    .where(eq(simulationScripts.simulationId, simulationId))
    .orderBy(desc(simulationScripts.createdAt));
}
