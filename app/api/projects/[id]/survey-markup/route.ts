import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

// PUT /api/projects/[id]/survey-markup
// Body: { locationId, markupPercent, cameraModelId, description, unitCost }
// Creates or updates a ProjectCost row keyed by (projectId, surveyLocationId).
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectId = Number(id);
  const b = await req.json();
  const locationId    = Number(b.locationId);
  const markupPercent = Number(b.markupPercent) || 0;
  const cameraModelId = b.cameraModelId ? Number(b.cameraModelId) : null;
  const unitCost      = b.unitCost      ? Number(b.unitCost)      : 0;
  const description   = b.description  || '';
  // Resolve Camera Equipment category
  const category = await prisma.lineItemCategory.findFirst({
    where: { name: 'Camera Equipment' },
    select: { id: true },
  });
  if (!category) return NextResponse.json({ error: 'Camera Equipment category not found' }, { status: 500 });

  // Upsert: find existing override for this location on this project, or create
  const existing = await prisma.projectCost.findFirst({
    where: { projectId, surveyLocationId: locationId },
  });

  const data = {
    categoryId:      category.id,
    cameraModelId,
    description,
    unitCost,
    markupPercent,
    billable:        true,
    surveyLocationId: locationId,
  };

  const record = existing
    ? await prisma.projectCost.update({ where: { id: existing.id }, data })
    : await prisma.projectCost.create({ data: { projectId, quantity: 1, ...data } });

  return NextResponse.json({ costId: record.id, markupPercent: Number(record.markupPercent) });
}
