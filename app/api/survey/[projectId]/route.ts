import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// GET /api/survey/[projectId]
//
// Returns one project and all of its CameraLocation records — i.e. its survey.
// A project owns exactly one (abstract) survey: the set of location records
// below it. There is no Survey entity; this route IS the survey load.
//
// Consumed solely by the iOS app (APIClient.fetchProject → SurveyBoardViewModel).
// The response is shaped 1:1 to the Swift Codable models, so the field guards
// below are load-bearing — they exist because Swift is stricter than Prisma:
//
//   • SurveyLocation.projectId  is non-optional Int   → coalesce null to projectId
//   • SurveyLocation.areaName   is non-optional String → coalesce null to ''
//   • SurveyPhoto.imageUrl      is non-optional String → coalesce null to ''
//
// cameraModel / accessMethod / images decode tolerantly on the client (try? /
// default []), but we still send well-formed objects so the board populates.
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
      projectType: true,
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
        select: {
          id: true,
          projectId: true,
          areaName: true,
          floor: true,
          surveyNotes: true,
          notes: true,
          mountingLocation: true,
          coveragePurpose: true,
          surveyedAt: true,
          cameraModelId: true,
          accessMethodId: true,
          cameraModel: {
            select: {
              id: true, manufacturer: true, model: true, cameraType: true,
              resolution: true, resolutionClass: true, imageUrl: true, ptz: true, indoorOutdoor: true,
            },
          },
          accessMethod: { select: { id: true, name: true } },
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

  // Floor plans for the assigned building (raw query — table may not exist on older DBs).
  let floorPlans: FloorPlanRow[] = [];
  if (project.buildingId) {
    try {
      floorPlans = await prisma.$queryRaw<FloorPlanRow[]>(
        Prisma.sql`SELECT plan_id, building_id, floor, original_file_name, file_url
          FROM building_floor_plans
          WHERE building_id = ${project.buildingId}
          ORDER BY floor ASC`
      );
    } catch { /* table may not exist yet */ }
  }

  const normalized = {
    id:          project.id,
    projectName: project.projectName,
    projectType: project.projectType, // Prisma enum identifier, e.g. "VIDEO_SURVEILLANCE"
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
      projectId:        l.projectId ?? projectId,   // Swift: non-optional Int
      areaName:         l.areaName ?? '',           // Swift: non-optional String
      floor:            l.floor,
      surveyNotes:      l.surveyNotes ?? null,
      notes:            l.notes ?? null,
      mountingLocation: l.mountingLocation ?? null,
      coveragePurpose:  l.coveragePurpose ?? null,
      surveyedAt:       l.surveyedAt ? new Date(l.surveyedAt).toISOString() : null,
      cameraModelId:    l.cameraModelId ?? null,
      accessMethodId:   l.accessMethodId ?? null,
      cameraModel:      l.cameraModel ?? null,
      accessMethod:     l.accessMethod ?? null,
      cameras:          [],                          // reserved; client defaults to []
      images: l.images.map(img => ({
        id:        img.id,
        imageUrl:  img.fileUrl ?? '',                // Swift: non-optional String
        caption:   img.description ?? null,
        createdAt: img.uploadedAt.toISOString(),
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
