import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// GET /api/sites
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId  = searchParams.get('projectId');
  const customerId = searchParams.get('customerId');
  const search     = searchParams.get('search') ?? '';

  let projectSiteIds: number[] | null = null;
  if (projectId) {
    const rows = await prisma.$queryRaw<{ B: number }[]>(
      Prisma.sql`SELECT B FROM _SiteProjects WHERE A = ${Number(projectId)}`
    ).catch(() => []);
    projectSiteIds = rows.map(r => Number(r.B));
  }

  const sites = await prisma.site.findMany({
    where: {
      ...(projectSiteIds !== null ? { id: { in: projectSiteIds } } : {}),
      ...(customerId ? { customerId: Number(customerId) } : {}),
      ...(search     ? { OR: [{ siteName: { contains: search } }, { city: { contains: search } }] } : {}),
    },
    include: {
      customer: { select: { id: true, customerName: true } },
      _count:   { select: { buildings: true } },
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
      address:    address    || null,
      city:       city       || null,
      state:      state      || null,
      notes:      notes      || null,
    },
  });

  if (projectId) {
    await prisma.$executeRaw(
      Prisma.sql`INSERT IGNORE INTO _SiteProjects (A, B) VALUES (${Number(projectId)}, ${site.id})`
    ).catch(() => null);
  }

  return NextResponse.json(site, { status: 201 });
}
