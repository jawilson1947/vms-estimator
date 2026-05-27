import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/survey/cameras?siteId=X
// Returns inventory cameras for the site (prefer) + unassigned cameras + full model library
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = parseInt(new URL(req.url).searchParams.get('siteId') ?? '');
  if (isNaN(siteId)) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  // Cameras already placed in buildings of this site
  const siteInventory = await prisma.camera.findMany({
    where: { location: { building: { siteId } } },
    select: {
      id: true,
      cameraCode: true,
      cameraName: true,
      status: true,
      locationId: true,
      model: { select: { manufacturer: true, modelNumber: true, cameraType: true } },
    },
    orderBy: { cameraCode: 'asc' },
  });

  // Cameras not yet assigned to any location (global pool)
  const unassigned = await prisma.camera.findMany({
    where: { locationId: null },
    select: {
      id: true,
      cameraCode: true,
      cameraName: true,
      status: true,
      locationId: true,
      model: { select: { manufacturer: true, modelNumber: true, cameraType: true } },
    },
    orderBy: { cameraCode: 'asc' },
  });

  // Merge, dedup by id (a site camera might also have locationId=null if just added)
  const seen = new Set<number>();
  const inventory = [...siteInventory, ...unassigned].filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  // Full model library as fallback
  const models = await prisma.cameraModel.findMany({
    select: {
      id: true,
      manufacturer: true,
      modelNumber: true,
      cameraType: true,
      resolution: true,
    },
    orderBy: [{ manufacturer: 'asc' }, { modelNumber: 'asc' }],
  });

  return NextResponse.json({ inventory, models });
}
