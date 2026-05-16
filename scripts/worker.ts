/**
 * BullMQ worker for asynchronous round execution.
 * Per spec § 37.3 / Phase E-1.
 *
 * Listens to queue 'simulation-rounds'. Each job payload:
 *   { sceneId, mode, params... }
 * Worker calls runRoundSimultaneous / runRoundHybrid and publishes events.
 *
 * Run:  npm run worker
 * Stop: Ctrl+C (graceful shutdown waits for in-flight jobs)
 */
import 'dotenv/config';
import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { entities, scenes, worlds } from '../src/db/schema';
import { runRoundSimultaneous } from '../src/lib/simulation/engine';
import { runRoundHybrid } from '../src/lib/simulation/engine-hybrid';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const QUEUE_NAME = 'simulation-rounds';

interface RunRoundJob {
  sceneId: string;
  mode?: 'simultaneous' | 'hybrid_two_phase';
}

async function processJob(job: Job<RunRoundJob>) {
  const { sceneId, mode = 'simultaneous' } = job.data;
  console.log(`[worker] job ${job.id} - scene=${sceneId} mode=${mode}`);

  const [scene] = await db.select().from(scenes).where(eq(scenes.id, sceneId));
  if (!scene) throw new Error(`Scene ${sceneId} not found`);

  const [world] = await db.select().from(worlds).where(eq(worlds.id, scene.worldId));
  if (!world) throw new Error(`World ${scene.worldId} not found`);

  const all = await db.select().from(entities).where(eq(entities.worldId, scene.worldId));
  const worldAgent = all.find((e) => e.entityType === 'world_agent');
  if (!worldAgent) throw new Error('No world_agent in this world');

  const params = {
    worldId: scene.worldId,
    worldlineId: scene.worldlineId,
    sceneId: scene.id,
    participantEntityIds: scene.participantEntityIds ?? [],
    worldAgentEntityId: worldAgent.id,
  };

  const result =
    mode === 'hybrid_two_phase'
      ? await runRoundHybrid(params)
      : await runRoundSimultaneous(params);

  console.log(
    `[worker] job ${job.id} done - status=${result.status} actions=${
      'actionIds' in result ? result.actionIds.length : 'N/A'
    }`,
  );
  return result;
}

async function main() {
  const connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<RunRoundJob>(QUEUE_NAME, processJob, {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2),
  });

  worker.on('completed', (job) => {
    console.log(`[worker] ✓ ${job.id}`);
  });
  worker.on('failed', (job, err) => {
    console.error(`[worker] ✗ ${job?.id} - ${err.message}`);
  });

  console.log(
    `[worker] listening to queue '${QUEUE_NAME}' on ${REDIS_URL} (concurrency=${process.env.WORKER_CONCURRENCY ?? 2})`,
  );

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[worker] shutting down...');
    await worker.close();
    await connection.quit();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('[worker] fatal:', e);
  process.exit(1);
});
