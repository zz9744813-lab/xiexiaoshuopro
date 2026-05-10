// db/repositories/project.ts - 项目仓库
import { eq } from 'drizzle-orm'
import { db } from '../index'
import { projects, projectSettings, type Project, type ProjectSettings } from '../schema'
import { logger } from '@/lib/logger'

export interface CreateProjectInput {
  title: string
  genre: string
  genreConfig?: Record<string, unknown>
  authorNotes?: string
  safetyLevel?: 'strict' | 'normal' | 'unrestricted'
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const [project] = await db.insert(projects).values({
    ...input,
    updatedAt: new Date(),
  }).returning()
  logger.info('Project created', { projectId: project.id })
  return project
}

export async function getProjectById(id: string): Promise<Project | null> {
  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1)
  return project || null
}

export async function listProjects(): Promise<Project[]> {
  return db.select().from(projects).orderBy(projects.createdAt)
}

export async function updateProject(
  id: string,
  data: Partial<Omit<Project, 'id' | 'createdAt'>>
): Promise<Project | null> {
  const [project] = await db
    .update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning()
  logger.info('Project updated', { projectId: id })
  return project || null
}

export async function deleteProject(id: string): Promise<boolean> {
  await db.delete(projects).where(eq(projects.id, id))
  logger.info('Project deleted', { projectId: id })
  return true
}

export async function getProjectSettings(projectId: string): Promise<ProjectSettings[]> {
  return db.select().from(projectSettings).where(eq(projectSettings.projectId, projectId))
}

export async function setProjectSetting(
  projectId: string,
  key: string,
  value: unknown
): Promise<void> {
  await db
    .insert(projectSettings)
    .values({ projectId, key, value: value as Record<string, unknown> })
    .onConflictDoUpdate({
      target: [projectSettings.projectId, projectSettings.key],
      set: { value: value as Record<string, unknown> },
    })
}
