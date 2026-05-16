/**
 * Decay job worker - runs memory decay calculation periodically.
 * Per spec § 14.2 / § 14.3.
 *
 * Strategy: every DECAY_INTERVAL_MS, iterate all worlds and run runDecayJob
 * for each. Sets archived_at on memories that have decayed past threshold
 * (handled inside runDecayJob).
 *
 * Run:  npm run worker:decay
 */
import 'dotenv/config';
import { db } from '../src/db';
import { worlds } from '../src/db/schema';
import { isNull } from 'drizzle-orm';
import { runDecayJob } from '../src/lib/memory/decay-job';

const INTERVAL_MS = Number(process.env.DECAY_INTERVAL_MS ?? 60 * 60 * 1000); // 1 hour

async function tick() {
  const all = await db.select().from(worlds).where(isNull(worlds.deletedAt));
  console.log(`[decay] tick - ${all.length} worlds`);
  for (const w of all) {
    try {
      const r = await runDecayJob({ worldId: w.id });
      console.log(`[decay] world=${w.id} scanned=${r.scanned} updated=${r.updated}`);
    } catch (e) {
      console.error(`[decay] world=${w.id} failed:`, e);
    }
  }
}

async function main() {
  console.log(`[decay] starting; interval=${INTERVAL_MS}ms`);
  await tick();
  setInterval(() => {
    void tick();
  }, INTERVAL_MS);

  process.on('SIGINT', () => {
    console.log('[decay] shutting down');
    process.exit(0);
  });
}

main().catch((e) => {
  console.error('[decay] fatal:', e);
  process.exit(1);
});
