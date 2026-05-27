import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// GET /api/survey/[siteId]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { siteId: siteIdStr } = await params;
  const siteId = parseInt(siteIdStr);
  if (isNaN(siteId)) return NextResponse.json({ error: 'Invalid site ID' }, { status: 400 });

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      buildings: {
        orderBy: { buildingName: 'asc' },
        include: {
          locations: {
            orderBy: { areaName: 'asc' },
            include: {
              cameras: {
                select: {
                  id: true, cameraCode: true, cameraName: true, status: true, locationId: true,
                  model: { select: { manufacturer: true, modelNumber: true, cameraType: true } },
                },
              },
              images: {
                where: { imageType: 'SITE_SURVEY' },
                select: { id: true, fileUrl: true, description: true, uploadedAt: true },
                orderBy: { uploadedAt: 'desc' },
              },
            },
          },
        },
      },
    },
  });

  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  // Fetch floor plans for all buildings via raw SQL
  const buildingIds = site.buildings.map(b => b.id);
  const floorPlansByBuilding: Record<number, FloorPlanRow[]> = {};
  if (buildingIds.length > 0) {
    try {
      const rows = await prisma.$queryRaw<FloorPlanRow[]>(
        Prisma.sql`SELECT plan_id, building_id, floor, original_file_name, file_url
          FROM building_floor_plans
          WHERE building_id IN (${Prisma.join(buildingIds)})
          ORDER BY floor ASC`
      );
      for (const r of rows) {
        if (!floorPlansByBuilding[r.building_id]) floorPlansByBuilding[r.building_id] = [];
        floorPlansByBuilding[r.building_id].push(r);
      }
    } catch { /* table may not exist yet */ }
  }

  const normalized = {
    ...site,
    buildings: site.buildings.map(b => ({
      ...b,
      floorPlans: (floorPlansByBuilding[b.id] ?? []).map(r => ({
        id:               r.plan_id,
        floor:            r.floor,
        originalFileName: r.original_file_name,
        fileUrl:          r.file_url,
      })),
      locations: b.locations.map(l => ({
        ...l,
        images: l.images.map(img => ({
          id:        img.id,
          imageUrl:  img.fileUrl ?? '',
          caption:   img.description ?? null,
          createdAt: img.uploadedAt,
        })),
      })),
    })),
  };

  return NextResponse.json(normalized);
}

interface FloorPlanRow {
  plan_id: number;
  building_id: number;
  floor: string;
  original_file_name: string | null;
  file_url: string | null;
}
