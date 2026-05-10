// db/repositories/base.ts - 基础仓储类（简化版）
import { eq } from 'drizzle-orm'
import { db, pool } from '@/db'
import { logger } from '@/lib/logger'

export interface RepositoryOptions {
  timeout?: number
}

// 简化的仓储基类
export abstract class BaseRepository<TInsert, TSelect> {
  protected db = db
  protected tableName: string
  protected table: any

  constructor(tableName: string, table: any) {
    this.tableName = tableName
    this.table = table
  }

  // 事务执行
  async withTransaction<R>(callback: (tx: typeof db) => Promise<R>): Promise<R> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await callback(this.db)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      logger.error('Transaction failed', { error: (error as Error).message })
      throw error
    } finally {
      client.release()
    }
  }

  // 基础CRUD
  async findById(id: string): Promise<TSelect | undefined> {
    const result = await (this.db as any)
      .select()
      .from(this.table)
      .where(eq(this.table.id, id))
      .limit(1)
    return result[0] as TSelect | undefined
  }

  async findAll(): Promise<TSelect[]> {
    return (this.db as any).select().from(this.table) as TSelect[]
  }

  async create(data: TInsert): Promise<TSelect> {
    const result = await (this.db as any).insert(this.table).values(data as Record<string, unknown>).returning()
    return result[0] as TSelect
  }

  async update(id: string, data: Partial<TInsert>): Promise<TSelect | undefined> {
    const result = await (this.db as any)
      .update(this.table)
      .set(data as Record<string, unknown>)
      .where(eq(this.table.id, id))
      .returning()
    return result[0] as TSelect | undefined
  }

  async delete(id: string): Promise<boolean> {
    const result = await (this.db as any)
      .delete(this.table)
      .where(eq(this.table.id, id))
      .returning()
    return result.length > 0
  }

  // 批量操作
  async batchCreate(data: TInsert[]): Promise<TSelect[]> {
    if (data.length === 0) return []
    const result = await (this.db as any)
      .insert(this.table)
      .values(data as Record<string, unknown>[])
      .returning()
    return result as TSelect[]
  }
}
