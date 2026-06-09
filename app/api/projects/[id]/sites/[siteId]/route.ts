import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

type Params = { params: Promise<{ id: string; siteId: string }> };

// DELETE /api/projects/[id]/sites/[siteId]
// Site-project linking is now managed via building assignment.
// This route is kept for compatibility but is a no-op.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/projects/[id]/sites/[siteId]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
