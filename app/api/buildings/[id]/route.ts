import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: { id: string } };

// PUT /api/buildings/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { buildingName, notes } = await req.json();
  if (!buildingName?.trim()) return NextResponse.json({ error: 'Building name is required' }, { status: 400 });

  const building = await prisma.building.update({
    where: { id: Number(params.id) },
    data:  { buildingName, notes: notes || null },
  });

  return NextResponse.json(building);
}

// DELETE /api/buildings/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.building.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ success: true });
}
