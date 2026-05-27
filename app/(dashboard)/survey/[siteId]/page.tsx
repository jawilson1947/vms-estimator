import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { SurveyBoard } from '@/components/SurveyBoard';

export async function generateMetadata({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = await prisma.site.findUnique({ where: { id: parseInt(siteId) }, select: { siteName: true } });
  return { title: site ? `Survey — ${site.siteName}` : 'Survey' };
}

interface SurveyFieldRow {
  location_id: number;
  survey_notes: string | null;
  surveyed_at:  Date | null;
}

export default async function SurveyPage({ params }: { params: Promise<{ siteId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const { siteId: siteIdStr } = await params;
  const siteId = parseInt(siteIdStr);
  if (isNaN(siteId)) notFound();

  // Main query — only touches fields the existing Prisma client knows about
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      buildings: {
        orderBy: { buildingName: 'asc' },
        include: {
          locations: {
            orderBy: { areaName: 'asc' },
            include: {
              cameras: { select: { id: true, cameraCode: true, status: true } },
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

  if (!site) notFound();

  // Fetch survey-specific columns via raw SQL so this works even if the
  // Prisma client hasn't been regenerated since the migration was applied.
  let surveyFields: SurveyFieldRow[] = [];
  try {
    surveyFields = await prisma.$queryRaw<SurveyFieldRow[]>`
      SELECT cl.location_id, cl.survey_notes, cl.surveyed_at
      FROM   camera_locations cl
      JOIN   buildings b ON cl.building_id = b.building_id
      WHERE  b.site_id = ${siteId}
    `;
  } catch {
    // Column not yet created — proceed with nulls for survey fields
  }

  const surveyMap = new Map<number, { surveyNotes: string | null; surveyedAt: string | null }>();
  for (const row of surveyFields) {
    surveyMap.set(row.location_id, {
      surveyNotes: row.survey_notes ?? null,
      surveyedAt:  row.surveyed_at ? new Date(row.surveyed_at).toISOString() : null,
    });
  }

  // Normalize into the shape SurveyBoard expects
  const normalizedSite = {
    id: site.id,
    siteName: site.siteName,
    buildings: site.buildings.map(b => ({
      id: b.id,
      buildingName: b.buildingName,
      locations: b.locations.map(l => {
        const sf = surveyMap.get(l.id) ?? { surveyNotes: null, surveyedAt: null };
        return {
          id:              l.id,
          buildingId:      l.buildingId,
          areaName:        l.areaName,
          floor:           l.floor,
          surveyNotes:     sf.surveyNotes,
          notes:           l.notes,
          mountingLocation: l.mountingLocation,
          coveragePurpose: l.coveragePurpose,
          surveyedAt:      sf.surveyedAt,
          cameras:         l.cameras,
          images: l.images.map(img => ({
            id:        img.id,
            imageUrl:  img.fileUrl ?? '',
            caption:   img.description ?? null,
            createdAt: img.uploadedAt.toISOString(),
          })),
        };
      }),
    })),
  };

  const totalLocations = normalizedSite.buildings.flatMap(b => b.locations).length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <Link href="/survey" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{site.siteName}</h1>
          <p className="text-sm text-gray-500">
            {site.buildings.length} building{site.buildings.length !== 1 ? 's' : ''}
            {' · '}
            {totalLocations} location{totalLocations !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <SurveyBoard initialSite={normalizedSite} />
    </div>
  );
}
