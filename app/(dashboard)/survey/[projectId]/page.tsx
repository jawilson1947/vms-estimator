import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { SurveyBoard } from '@/components/SurveyBoard';
import { AccessSurveyBoard } from '@/components/AccessSurveyBoard';

export async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: parseInt(projectId) },
    select: { projectName: true, building: { select: { buildingName: true } } },
  });
  return { title: project ? `Survey -- ${project.projectName}` : 'Survey' };
}

export default async function SurveyPage({ params }: { params: Promise<{ projectId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const { projectId: projectIdStr } = await params;
  const projectId = parseInt(projectIdStr);
  if (isNaN(projectId)) notFound();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id:          true,
      projectName: true,
      projectType: true,
      building: {
        select: {
          id:           true,
          buildingName: true,
          site:         { select: { siteName: true } },
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
          accessMethod: { select: { id: true, name: true } },
          images: {
            where:   { imageType: 'SITE_SURVEY' },
            select:  { id: true, fileUrl: true, description: true, uploadedAt: true },
            orderBy: { uploadedAt: 'desc' },
          },
        },
      },
    },
  });

  if (!project) notFound();

  const isAccessControl = project.projectType === 'ACCESS_CONTROL';

  interface FloorPlanRow {
    plan_id: number; building_id: number; floor: string;
    original_file_name: string | null; file_url: string | null;
  }
  let floorPlans: FloorPlanRow[] = [];
  if (project.building) {
    try {
      floorPlans = await prisma.$queryRaw<FloorPlanRow[]>(
        Prisma.sql`SELECT plan_id, building_id, floor, original_file_name, file_url
          FROM building_floor_plans WHERE building_id = ${project.building.id} ORDER BY floor ASC`
      );
    } catch { /* table may not exist yet */ }
  }

  const building = project.building ? {
    id:           project.building.id,
    buildingName: project.building.buildingName,
    siteName:     project.building.site?.siteName ?? null,
    floorPlans:   floorPlans.map(r => ({
      id: r.plan_id, floor: r.floor,
      originalFileName: r.original_file_name, fileUrl: r.file_url,
    })),
  } : null;

  const baseLocations = project.cameraLocations.map(l => ({
    id:          l.id,
    projectId:   l.projectId,
    areaName:    l.areaName,
    floor:       l.floor,
    surveyNotes: l.surveyNotes ?? null,
    surveyedAt:  l.surveyedAt ? new Date(l.surveyedAt).toISOString() : null,
    images:      l.images.map(img => ({
      id:        img.id,
      imageUrl:  img.fileUrl ?? '',
      caption:   img.description ?? null,
      createdAt: img.uploadedAt.toISOString(),
    })),
  }));

  const totalLocations = baseLocations.length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <Link href="/survey" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{project.projectName}</h1>
          <p className="text-sm text-gray-500">
            {project.building?.buildingName ?? 'No building assigned'}
            {project.building?.site?.siteName && <> &middot; {project.building.site.siteName}</>}
            {' · '}
            {totalLocations} {isAccessControl ? 'access point' : 'location'}{totalLocations !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {isAccessControl ? (
        <AccessSurveyBoard
          initialProject={{
            id:          project.id,
            projectName: project.projectName,
            building,
            locations: baseLocations.map((loc, i) => ({
              ...loc,
              accessMethod: project.cameraLocations[i].accessMethod ?? null,
            })),
          }}
        />
      ) : (
        <SurveyBoard
          initialProject={{
            id:          project.id,
            projectName: project.projectName,
            building,
            locations: baseLocations.map((loc, i) => {
              const l = project.cameraLocations[i];
              return {
                ...loc,
                notes:            l.notes,
                mountingLocation: l.mountingLocation,
                coveragePurpose:  l.coveragePurpose,
                cameraModel:      l.cameraModel ?? null,
              };
            }),
          }}
        />
      )}
    </div>
  );
}
