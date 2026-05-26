import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: { id: string } };

// GET /api/sites/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const site = await prisma.site.findUnique({
    where:   { id: Number(params.id) },
    include: {
      customer:  { select: { id: true, customerName: true } },
      project:   { select: { id: true, projectName: true } },
      buildings: {
        orderBy: { buildingName: 'asc' },
        include: {
          _count:    { select: { locations: true } },
          locations: {
            orderBy: { areaName: 'asc' },
            include: { _count: { select: { cameras: true } } },
          },
        },
      },
    },
  });

  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(site);
}

// PUT /api/sites/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { siteName, customerId, projectId, address, city, state, notes } = body;

  if (!siteName?.trim()) return NextResponse.json({ error: 'Site name is required' }, { status: 400 });

  const site = await prisma.site.update({
    where: { id: Number(params.id) },
    data:  {
      siteName,
      customerId: customerId ? Number(customerId) : null,
      projectId:  projectId  ? Number(projectId)  : null,
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
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.site.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ success: true });
}
