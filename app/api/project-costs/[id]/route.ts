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

  await prisma.projectCost.update({
    where: { id: Number(id) },
    data:  {
      categoryId:    Number(b.categoryId),
      description:   b.description  || null,
      quantity:      b.quantity     ? Number(b.quantity)      : 1,
      unitCost:      b.unitCost     ? Number(b.unitCost)      : 0,
      markupPercent: b.markupPercent? Number(b.markupPercent) : 0,
      vendor:        b.vendor       || null,
      costDate:      b.costDate     ? new Date(b.costDate)    : null,
      billable:      b.billable !== undefined ? !!b.billable  : true,
      notes:         b.notes        || null,
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
