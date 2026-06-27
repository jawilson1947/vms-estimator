import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildLocationLabelModels,
  generateLocationLabelsDocx,
  isAverySize,
  DEFAULT_AVERY_SIZE,
  type ProjectTypeValue,
} from '@/lib/generate-location-labels-docx';

// GET /api/projects/[id]/location-labels?size=5163[&preview=1]
// Returns a print-ready Avery label sheet (.docx) for the project's survey locations.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const projectId = Number(id);

  const sizeParam = req.nextUrl.searchParams.get('size');
  const size = isAverySize(sizeParam) ? sizeParam : DEFAULT_AVERY_SIZE;
  const preview = req.nextUrl.searchParams.get('preview') === '1';

  // Start label position (1-based) so a partially-used sheet can be reused.
  const parsePos = (v: string | null) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  };
  const startRow = parsePos(req.nextUrl.searchParams.get('row'));
  const startCol = parsePos(req.nextUrl.searchParams.get('col'));

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      projectName: true,
      projectType: true,
      cameraLocations: {
        orderBy: [{ floor: 'asc' }, { areaName: 'asc' }],
        select: {
          areaName:         true,
          floor:            true,
          mountingLocation: true,
          surveyNotes:      true,
          cameraModel:  { select: { manufacturer: true, model: true } },
          accessMethod: {
            select: {
              name:  true,
              items: {
                orderBy: { artifactType: { sortOrder: 'asc' } },
                select:  { quantity: true, artifactType: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const models = buildLocationLabelModels(
    project.projectType as ProjectTypeValue,
    project.cameraLocations,
  );
  const buf = await generateLocationLabelsDocx(models, size, {
    previewBorders: preview,
    projectName:    project.projectName,
    startRow,
    startCol,
  });

  const slug = project.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="location-labels-${slug}-${size}.docx"`,
    },
  });
}
