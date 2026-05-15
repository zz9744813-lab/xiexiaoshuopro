import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/xiexiaoshuopro';

export const pool = new Pool({
  connectionString,
  max: 10,
});

export const db = drizzle(pool, { schema });

export type DB = typeof db;
export { schema };
