import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

// PUT /api/projects/[id]/access-bom
// Body: { artifactTypeId, artifactModelId, quantity, unitCost, markupPercent, description }
// Creates or updates a ProjectCost row keyed by (projectId, artifactTypeId).
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectId = Number(id);
  const b = await req.json();
  const artifactTypeId = Number(b.artifactTypeId);
  if (!artifactTypeId) return NextResponse.json({ error: 'artifactTypeId is required' }, { status: 400 });

  const artifactModelId = b.artifactModelId ? Number(b.artifactModelId) : null;
  const quantity        = Number(b.quantity)      || 1;
  const unitCost        = Number(b.unitCost)      || 0;
  const markupPercent   = Number(b.markupPercent) || 0;
  const description     = b.description || '';

  const category = await prisma.lineItemCategory.findFirst({
    where: { name: 'Access Control Equipment' },
    select: { id: true },
  });
  if (!category) return NextResponse.json({ error: 'Access Control Equipment category not found' }, { status: 500 });

  const existing = await prisma.projectCost.findFirst({
    where: { projectId, artifactTypeId },
  });

  const data = {
    categoryId: category.id,
    artifactTypeId,
    artifactModelId,
    description,
    quantity,
    unitCost,
    markupPercent,
    billable: true,
  };

  const record = existing
    ? await prisma.projectCost.update({ where: { id: existing.id }, data })
    : await prisma.projectCost.create({ data: { projectId, ...data } });

  return NextResponse.json({
    costId:        record.id,
    quantity:      Number(record.quantity),
    unitCost:      Number(record.unitCost),
    markupPercent: Number(record.markupPercent),
  });
}
