import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma, ProjectStatus } from '@prisma/client';

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
      customer: { select: { id: true, customerName: true } },
      _count:   { select: { costs: true } },
    },
    orderBy: { projectName: 'asc' },
  });

  // Derive site for each project via its building
  interface SiteRow { projectId: number; siteId: number; siteName: string }
  const projectIds = projects.map(p => p.id);
  const siteRows = projectIds.length > 0
    ? await prisma.$queryRaw<SiteRow[]>(
        Prisma.sql`SELECT p.project_id AS projectId, s.site_id AS siteId, s.site_name AS siteName
                   FROM projects p
                   JOIN buildings b ON b.building_id = p.building_id
                   JOIN sites s     ON s.site_id = b.site_id
                   WHERE p.project_id IN (${Prisma.join(projectIds)})`
      ).catch(() => [] as SiteRow[])
    : [];

  const siteByProject = new Map(siteRows.map(r => [r.projectId, { id: r.siteId, siteName: r.siteName }]));

  const result = projects.map(p => ({
    ...p,
    site: siteByProject.get(p.id) ?? null,
  }));

  return NextResponse.json(result);
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
