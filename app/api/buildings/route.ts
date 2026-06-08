import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/buildings?siteId=
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = new URL(req.url).searchParams.get('siteId');

  const buildings = await prisma.building.findMany({
    where:   siteId ? { siteId: Number(siteId) } : undefined,
    include: {
      _count: { select: { locations: true } },
      site:   { select: { siteName: true, city: true, state: true } },
    },
    orderBy: [{ site: { siteName: 'asc' } }, { buildingName: 'asc' }],
  });

  return NextResponse.json(buildings);
}

// POST /api/buildings
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { siteId, buildingName, notes } = body;

  if (!buildingName?.trim()) return NextResponse.json({ error: 'Building name is required' }, { status: 400 });
  if (!siteId)               return NextResponse.json({ error: 'Site is required' },          { status: 400 });

  const building = await prisma.building.create({
    data: { siteId: Number(siteId), buildingName, notes: notes || null },
  });

  return NextResponse.json(building, { status: 201 });
}
