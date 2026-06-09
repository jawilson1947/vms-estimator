import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// GET /api/survey/[projectId]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { projectId: projectIdStr } = await params;
  const projectId = parseInt(projectIdStr);
  if (isNaN(projectId)) return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      projectName: true,
      buildingId: true,
      building: {
        select: {
          id: true,
          buildingName: true,
          siteId: true,
          site: { select: { id: true, siteName: true } },
        },
      },
      cameraLocations: {
        orderBy: { areaName: 'asc' },
        include: {
          cameraModel: {
            select: {
              id: true, manufacturer: true, model: true, cameraType: true,
              resolution: true, resolutionClass: true, imageUrl: true, ptz: true, indoorOutdoor: true,
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
  });

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Fetch floor plans for the assigned building
  const floorPlans: FloorPlanRow[] = [];
  if (project.buildingId) {
    try {
      const rows = await prisma.$queryRaw<FloorPlanRow[]>(
        Prisma.sql`SELECT plan_id, building_id, floor, original_file_name, file_url
          FROM building_floor_plans
          WHERE building_id = ${project.buildingId}
          ORDER BY floor ASC`
      );
      floorPlans.push(...rows);
    } catch { /* table may not exist yet */ }
  }

  const normalized = {
    id:          project.id,
    projectName: project.projectName,
    building:    project.building
      ? {
          id:           project.building.id,
          buildingName: project.building.buildingName,
          siteName:     project.building.site?.siteName ?? null,
          floorPlans:   floorPlans.map(r => ({
            id:               r.plan_id,
            floor:            r.floor,
            originalFileName: r.original_file_name,
            fileUrl:          r.file_url,
          })),
        }
      : null,
    locations: project.cameraLocations.map(l => ({
      id:               l.id,
      projectId:        l.projectId,
      areaName:         l.areaName,
      floor:            l.floor,
      surveyNotes:      l.surveyNotes,
      notes:            l.notes,
      mountingLocation: l.mountingLocation,
      coveragePurpose:  l.coveragePurpose,
      surveyedAt:       l.surveyedAt ? new Date(l.surveyedAt).toISOString() : null,
      cameraModel:      l.cameraModel ?? null,
      images:           l.images.map(img => ({
        id:        img.id,
        imageUrl:  img.fileUrl ?? "",
        caption:   img.description ?? null,
        createdAt: img.uploadedAt,
      })),
    })),
  };

  return NextResponse.json(normalized);
}

interface FloorPlanRow {
  plan_id:            number;
  building_id:        number;
  floor:              string;
  original_file_name: string | null;
  file_url:           string | null;
}
