import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/sites
// Site-project linking is now managed via building assignment.
// This route is kept for compatibility but is a no-op.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    await params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await req.json();
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[POST /api/projects/[id]/sites]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
