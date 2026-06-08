import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/[id]/costs
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const costs = await prisma.projectCost.findMany({
    where:   { projectId: Number(id) },
    include: { category: true },
    orderBy: [{ category: { sortOrder: 'asc' } }, { id: 'asc' }],
  });

  return NextResponse.json(costs);
}

// POST /api/projects/[id]/costs
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await req.json();

  if (!b.categoryId) return NextResponse.json({ error: 'Category is required' }, { status: 400 });

  // If a camera model is linked, always use its catalog price
  const cameraModelId = b.cameraModelId ? Number(b.cameraModelId) : null;
  let unitCost = b.unitCost ? Number(b.unitCost) : 0;
  if (cameraModelId) {
    const cam = await prisma.cameraModel.findUnique({ where: { id: cameraModelId }, select: { cost: true } });
    if (cam?.cost) unitCost = Number(cam.cost);
  }
  const quantity    = b.quantity      ? Number(b.quantity)      : 1;
  const markupPct   = b.markupPercent ? Number(b.markupPercent) : 0;

  const cost = await prisma.projectCost.create({
    data: {
      projectId:     Number(id),
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

  // Re-read to get the DB-computed lineTotal and category relation
  const fresh = await prisma.projectCost.findUnique({
    where:   { id: cost.id },
    include: { category: true },
  });
  return NextResponse.json(fresh, { status: 201 });
}
