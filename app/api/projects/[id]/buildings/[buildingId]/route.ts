import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string; buildingId: string }> };

// DELETE /api/projects/[id]/buildings/[buildingId]  — remove building from this project
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await prisma.$executeRaw`
      UPDATE projects SET building_id = NULL WHERE project_id = ${Number(id)}
    `;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/projects/[id]/buildings/[buildingId]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
