import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

// PUT /api/project-costs/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await req.json();

  // If a camera model is linked, always use its catalog price
  const cameraModelId = b.cameraModelId ? Number(b.cameraModelId) : null;
  let unitCost = b.unitCost ? Number(b.unitCost) : 0;
  if (cameraModelId) {
    const cam = await prisma.cameraModel.findUnique({ where: { id: cameraModelId }, select: { cost: true } });
    if (cam?.cost) unitCost = Number(cam.cost);
  }
  const quantity    = b.quantity      ? Number(b.quantity)      : 1;
  const markupPct   = b.markupPercent ? Number(b.markupPercent) : 0;

  await prisma.projectCost.update({
    where: { id: Number(id) },
    data:  {
      categoryId:    Number(b.categoryId),
      cameraModelId,
      description:   b.description || null,
      quantity,
      unitCost,
      markupPercent: markupPct,
      vendor:        b.vendor   || null,
      url:           b.url      || null,
      costDate:      b.costDate ? new Date(b.costDate) : null,
      billable:      b.billable !== undefined ? !!b.billable : true,
      notes:         b.notes    || null,
    },
  });

  // Re-read to return the fresh DB-computed lineTotal and category relation
  const fresh = await prisma.projectCost.findUnique({
    where:   { id: Number(id) },
    include: { category: true },
  });
  return NextResponse.json(fresh);
}

// DELETE /api/project-costs/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.projectCost.delete({ where: { id: Number(id) } });
  return NextResponse.json({ success: true });
}
