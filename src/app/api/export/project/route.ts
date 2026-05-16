import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { worlds } from '@/db/schema';
import { badRequest, notFound, serverError } from '@/lib/api-response';
import { getAuthContext } from '@/lib/auth';
import { exportProject } from '@/lib/export/project-export';

// GET /api/export/project?world_id=...&include_private=true
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const worldId = searchParams.get('world_id');
    const includePrivate = searchParams.get('include_private') === 'true';
    if (!worldId) return badRequest('world_id is required');

    const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId));
    if (!world) return notFound('World not found');
    if (world.ownerUserId !== auth.userId) return badRequest('Invalid world');

    const bundle = await exportProject({ worldId, includePrivate });
    const json = JSON.stringify(bundle, null, 2);
    const safeName = (world.name || 'world').replace(/[\\/:*?"<>|]/g, '_');

    return new Response(json, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}-export.json`,
      },
    });
  } catch (e) {
    return serverError('Failed', String(e));
  }
}
