import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/sites
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId  = searchParams.get('projectId');
  const customerId = searchParams.get('customerId');
  const search     = searchParams.get('search') ?? '';

  const sites = await prisma.site.findMany({
    where: {
      ...(projectId  ? { projectId:  Number(projectId)  } : {}),
      ...(customerId ? { customerId: Number(customerId) } : {}),
      ...(search     ? { OR: [{ siteName: { contains: search } }, { city: { contains: search } }] } : {}),
    },
    include: {
      customer:  { select: { id: true, customerName: true } },
      project:   { select: { id: true, projectName: true } },
      _count:    { select: { buildings: true } },
    },
    orderBy: { siteName: 'asc' },
  });

  return NextResponse.json(sites);
}

// POST /api/sites
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { siteName, customerId, projectId, address, city, state, notes } = body;

  if (!siteName?.trim()) return NextResponse.json({ error: 'Site name is required' }, { status: 400 });

  const site = await prisma.site.create({
    data: {
      siteName,
      customerId: customerId ? Number(customerId) : null,
      projectId:  projectId  ? Number(projectId)  : null,
      address:    address    || null,
      city:       city       || null,
      state:      state      || null,
      notes:      notes      || null,
    },
  });

  return NextResponse.json(site, { status: 201 });
}
