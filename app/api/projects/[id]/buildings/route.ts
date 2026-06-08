import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/buildings  — assign a building (and its parent site) to this project
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const projectId = Number(id);

    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const buildingId = body?.buildingId ? Number(body.buildingId) : null;
    if (!buildingId || isNaN(buildingId)) {
      return NextResponse.json({ error: 'buildingId is required' }, { status: 400 });
    }

    const building = await prisma.building.findUnique({ where: { id: buildingId } });
    if (!building) return NextResponse.json({ error: 'Building not found' }, { status: 404 });

    // Set both building_id and site_id via raw SQL (until prisma generate is run)
    await prisma.$executeRaw`
      UPDATE projects
      SET building_id = ${buildingId}, site_id = ${building.siteId}
      WHERE project_id = ${projectId}
    `;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[POST /api/projects/[id]/buildings]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
