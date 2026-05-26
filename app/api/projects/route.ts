import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ProjectStatus } from '@prisma/client';

// GET /api/projects
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search     = searchParams.get('search') ?? '';
  const customerId = searchParams.get('customerId');
  const status     = searchParams.get('status') as ProjectStatus | null;

  const projects = await prisma.project.findMany({
    where: {
      ...(customerId ? { customerId: Number(customerId) } : {}),
      ...(status     ? { projectStatus: status }          : {}),
      ...(search
        ? {
            OR: [
              { projectName:   { contains: search } },
              { projectNumber: { contains: search } },
              { projectManager:{ contains: search } },
            ],
          }
        : {}),
    },
    include: {
      customer:  { select: { id: true, customerName: true } },
      _count:    { select: { sites: true, costs: true } },
    },
    orderBy: { projectName: 'asc' },
  });

  return NextResponse.json(projects);
}

// POST /api/projects
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    customerId, projectName, projectNumber, projectStatus,
    startDate, completionDate, projectManager,
    consultingRate, overheadRatePercent, notes,
  } = body;

  if (!projectName?.trim()) return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
  if (!customerId)          return NextResponse.json({ error: 'Customer is required' },     { status: 400 });

  const project = await prisma.project.create({
    data: {
      customerId:          Number(customerId),
      projectName,
      projectNumber:       projectNumber       || null,
      projectStatus:       projectStatus       || ProjectStatus.PROPOSED,
      startDate:           startDate           ? new Date(startDate)      : null,
      completionDate:      completionDate      ? new Date(completionDate) : null,
      projectManager:      projectManager      || null,
      consultingRate:      consultingRate      ? Number(consultingRate)      : null,
      overheadRatePercent: overheadRatePercent ? Number(overheadRatePercent) : null,
      notes:               notes               || null,
    },
  });

  return NextResponse.json(project, { status: 201 });
}
