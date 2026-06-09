import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

interface ProjectRow { id: number; projectName: string; }

// GET /api/sites/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = Number(id);

  const [site, projects] = await Promise.all([
    prisma.site.findUnique({
      where:   { id: siteId },
      include: {
        customer:  { select: { id: true, customerName: true } },
        buildings: {
          orderBy: { buildingName: 'asc' },
          include: {
            projects: {
              include: {
                cameraLocations: {
                  orderBy: { areaName: 'asc' },
                  select: {
                    id: true, areaName: true, floor: true,
                    mountingLocation: true, coveragePurpose: true,
                    cameraModelId: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.$queryRaw<ProjectRow[]>(
      Prisma.sql`SELECT p.project_id AS id, p.project_name AS projectName
                 FROM projects p
                 JOIN buildings b ON b.building_id = p.building_id
                 WHERE b.site_id = ${siteId}`
    ).catch(() => [] as ProjectRow[]),
  ]);

  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ...site, projects });
}

// PUT /api/sites/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { siteName, customerId, address, city, state, notes } = body;

  if (!siteName?.trim()) return NextResponse.json({ error: 'Site name is required' }, { status: 400 });

  const site = await prisma.site.update({
    where: { id: Number(id) },
    data:  {
      siteName,
      customerId: customerId ? Number(customerId) : null,
      address:    address    || null,
      city:       city       || null,
      state:      state      || null,
      notes:      notes      || null,
    },
  });

  return NextResponse.json(site);
}

// DELETE /api/sites/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.site.delete({ where: { id: Number(id) } });
  return NextResponse.json({ success: true });
}
