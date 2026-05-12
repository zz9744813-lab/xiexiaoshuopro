// db/schema/_pgvector.ts - pgvector custom column type for drizzle-orm
import { customType } from 'drizzle-orm/pg-core'

/**
 * pgvector vector(N) custom type.
 * Maps to Postgres vector(1536) for OpenAI text-embedding-3-small,
 * stored as number[] in TS.
 */
export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)'
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value)
  },
  fromDriver(value: string): number[] {
    if (typeof value === 'string') {
      // pgvector stores as [0.1,0.2,...]
      return JSON.parse(value)
    }
    return value as unknown as number[]
  },
})
