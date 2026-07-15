import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

// PUT /api/projects/[id]/general-bom
// Body: { generalItemId, quantity, unitCost, markupPercent, description, removed? }
// Creates or updates a ProjectCost row keyed by (projectId, generalItemId) — the
// General-project equivalent of the access-bom override rows. removed:true stores
// a quantity-0 marker row that hides the line from the cost page (legit rows always
// have quantity > 0); removed:false deletes the marker.
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectId = Number(id);
  const b = await req.json();
  const generalItemId = Number(b.generalItemId);
  if (!generalItemId) return NextResponse.json({ error: 'generalItemId is required' }, { status: 400 });

  const quantity      = Number(b.quantity)      || 1;
  const unitCost      = Number(b.unitCost)      || 0;
  const markupPercent = Number(b.markupPercent) || 0;
  const description   = b.description || '';

  const category = await prisma.lineItemCategory.findFirst({
    where:  { name: 'General Equipment' },
    select: { id: true },
  });
  if (!category) return NextResponse.json({ error: 'General Equipment category not found — run the General project type migration' }, { status: 500 });

  const existing = await prisma.projectCost.findFirst({
    where: { projectId, generalItemId },
  });

  if (b.removed === true) {
    const marker = {
      categoryId: category.id,
      generalItemId,
      description,
      quantity: 0,
      unitCost: 0,
      markupPercent: 0,
      billable: false,
    };
    const record = existing
      ? await prisma.projectCost.update({ where: { id: existing.id }, data: marker })
      : await prisma.projectCost.create({ data: { projectId, ...marker } });
    return NextResponse.json({ costId: record.id, removed: true });
  }

  if (b.removed === false) {
    if (existing) await prisma.projectCost.delete({ where: { id: existing.id } });
    return NextResponse.json({ removed: false });
  }

  const data = {
    categoryId: category.id,
    generalItemId,
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
