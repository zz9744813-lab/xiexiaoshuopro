import { NextRequest } from 'next/server';
import { eventBus, type SimEvent } from '@/lib/events/event-bus';

/**
 * Server-Sent Events stream for a world's simulation events.
 * Client subscribes via: new EventSource(`/api/events/stream?world_id=...`)
 *
 * Per spec 34.3 - heartbeat every 30s, last_event_id reconnect support.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const worldId = searchParams.get('world_id');
  if (!worldId) {
    return new Response('world_id is required', { status: 400 });
  }
  const lastEventId = req.headers.get('Last-Event-ID') ?? undefined;
  const heartbeatSec = Number(process.env.WEBSOCKET_HEARTBEAT_SECONDS ?? 30);

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function write(ev: SimEvent) {
        const payload = `id: ${ev.id}\nevent: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // closed
        }
      }

      // Replay buffered events
      const recent = eventBus.recent(lastEventId);
      for (const e of recent) write(e);

      const unsubscribe = eventBus.subscribe(worldId, write);

      // Heartbeat
      const hb = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          // closed
        }
      }, heartbeatSec * 1000);

      // Cleanup on abort
      const abort = () => {
        clearInterval(hb);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener('abort', abort);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
