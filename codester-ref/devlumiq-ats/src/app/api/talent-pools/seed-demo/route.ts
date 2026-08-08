import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';
import { ensureDemoTalentPools } from '@/lib/ensure-demo-talent-pools';

/** POST — force-create demo talent pools + sample candidates for this org. */
export const POST = withPermission('CREATE_CANDIDATE', async (req: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;

    const result = await ensureDemoTalentPools(orgId, session.id, { force });
    return NextResponse.json(result);
  } catch (e) {
    console.error('POST /api/talent-pools/seed-demo', e);
    const message = e instanceof Error ? e.message : 'Failed to seed talent pools';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
