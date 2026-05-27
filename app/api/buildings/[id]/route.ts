import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

// PUT /api/buildings/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { buildingName, notes } = await req.json();
  if (!buildingName?.trim()) return NextResponse.json({ error: 'Building name is required' }, { status: 400 });

  const building = await prisma.building.update({
    where: { id: Number(id) },
    data:  { buildingName, notes: notes || null },
  });

  return NextResponse.json(building);
}

// DELETE /api/buildings/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await prisma.building.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'P2003' || code === 'P2014') {
      return NextResponse.json(
        { error: 'Cannot delete a building that still has locations or cameras. Remove them first.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
