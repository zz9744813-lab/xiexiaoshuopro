// src/db/schema/_pgvector.ts
import { customType } from 'drizzle-orm/pg-core'

export const VECTOR_DIM = 1024

export const vector = customType<{ data: number[]; driverData: string }>({
  dataType: () => `vector(${VECTOR_DIM})`,
  toDriver: (v) => `[${v.join(',')}]`,
  fromDriver: (v) => {
    if (typeof v === 'string') {
      return JSON.parse(v)
    }
    return v as number[]
  },
})
