import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ProjectStatus } from '@prisma/client';

type Params = { params: { id: string } };

// GET /api/projects/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const project = await prisma.project.findUnique({
    where:   { id: Number(params.id) },
    include: {
      customer:   { select: { id: true, customerName: true } },
      sites: {
        orderBy: { siteName: 'asc' },
        include: { buildings: { include: { _count: { select: { locations: true } } } } },
      },
      costs:      { orderBy: { costCategory: 'asc' } },
      feeSummary: true,
    },
  });

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(project);
}

// PUT /api/projects/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    customerId, projectName, projectNumber, projectStatus,
    startDate, completionDate, projectManager,
    consultingRate, overheadRatePercent, notes,
  } = body;

  if (!projectName?.trim()) return NextResponse.json({ error: 'Project name is required' }, { status: 400 });

  const project = await prisma.project.update({
    where: { id: Number(params.id) },
    data:  {
      customerId:          Number(customerId),
      projectName,
      projectNumber:       projectNumber       || null,
      projectStatus:       projectStatus       as ProjectStatus,
      startDate:           startDate           ? new Date(startDate)      : null,
      completionDate:      completionDate      ? new Date(completionDate) : null,
      projectManager:      projectManager      || null,
      consultingRate:      consultingRate      ? Number(consultingRate)      : null,
      overheadRatePercent: overheadRatePercent ? Number(overheadRatePercent) : null,
      notes:               notes               || null,
    },
  });

  return NextResponse.json(project);
}

// DELETE /api/projects/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.project.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ success: true });
}
