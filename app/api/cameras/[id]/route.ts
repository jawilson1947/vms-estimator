import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildData } from '../route';

type Params = { params: Promise<{ id: string }> };

// GET /api/cameras/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const model = await prisma.cameraModel.findUnique({
    where: { id: Number(id) },
    include: { locations: { select: { id: true, areaName: true, floor: true,
      building: { select: { buildingName: true, site: { select: { siteName: true } } } } } } },
  });

  if (!model) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(model);
}

// PUT /api/cameras/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await req.json();
  const model = await prisma.cameraModel.update({
    where: { id: Number(id) },
    data:  buildData(b),
  });

  return NextResponse.json(model);
}

// DELETE /api/cameras/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Unlink any locations assigned this model before deleting
  await prisma.cameraLocation.updateMany({
    where: { cameraModelId: Number(id) },
    data:  { cameraModelId: null },
  });

  await prisma.cameraModel.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
