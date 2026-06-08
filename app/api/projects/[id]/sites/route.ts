import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/sites  — assign a site to this project (one-to-many FK)
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const projectId = Number(id);

    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const siteId = body?.siteId ? Number(body.siteId) : null;
    if (!siteId || isNaN(siteId)) {
      return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
    }

    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    await prisma.project.update({
      where: { id: projectId },
      data:  { siteId },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[POST /api/projects/[id]/sites]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
