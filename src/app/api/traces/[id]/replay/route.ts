import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { simulationTraces, worlds } from '@/db/schema';
import { ok, badRequest, notFound, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';
import { callLLM } from '@/lib/simulation/llm-service';

const replaySchema = z.object({
  /** Override profile if provided; otherwise use original */
  apiProfileId: z.string().uuid().optional(),
});

// POST /api/traces/[id]/replay
// Per spec 29.3 - replay does NOT write to actions/memories.
// It creates a new trace with trace_type=replay.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const auth = await getAuthContext();
    const body = await req.json().catch(() => ({}));
    const parsed = replaySchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten());

    const [trace] = await db.select().from(simulationTraces).where(eq(simulationTraces.id, id));
    if (!trace) return notFound('Trace not found');

    const [world] = await db.select().from(worlds).where(eq(worlds.id, trace.worldId));
    if (!world || world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    if (!trace.promptMessages || !Array.isArray(trace.promptMessages)) {
      return badRequest('Original trace has no prompt messages');
    }

    const apiProfileId = parsed.data.apiProfileId ?? trace.apiProfileId;
    if (!apiProfileId) return badRequest('No api_profile to replay with');

    const result = await callLLM(
      trace.promptMessages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
      {
        apiProfileId,
        worldId: trace.worldId,
        worldlineId: trace.worldlineId,
        sceneId: trace.sceneId ?? undefined,
        roundId: trace.roundId ?? undefined,
        entityId: trace.entityId ?? undefined,
        traceType: 'replay',
        phase: trace.phase ?? undefined,
        // No schema validation on replay; user wants raw comparison
        inputContext: trace.inputContext,
      },
    );

    return ok({
      original_trace_id: id,
      replay_trace_id: result.traceId,
      response: {
        rawText: result.response.rawText,
        parsedJson: result.response.parsedJson,
        tokenInput: result.response.tokenInput,
        tokenOutput: result.response.tokenOutput,
        latencyMs: result.response.latencyMs,
      },
    });
  } catch (e) {
    return serverError('Replay failed', String(e));
  }
}
