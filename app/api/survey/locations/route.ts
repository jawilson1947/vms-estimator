import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/survey/locations — quick-create a location during a survey walk
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { projectId, areaName, floor, surveyNotes, accessMethodId } = body;

  if (!projectId || !areaName) {
    return NextResponse.json({ error: 'projectId and areaName are required' }, { status: 400 });
  }

  const location = await prisma.cameraLocation.create({
    data: {
      projectId: parseInt(projectId),
      areaName,
      floor:          floor ?? null,
      surveyNotes:    surveyNotes ?? null,
      accessMethodId: typeof accessMethodId === 'number' ? accessMethodId : null,
      surveyedAt:     new Date(),
    },
    include: {
      accessMethod: { select: { id: true, name: true } },
    },
  });

  const images: { id: number; imageUrl: string; caption: string | null; createdAt: string }[] = [];
  return NextResponse.json({
    id:               location.id,
    projectId:        location.projectId,
    areaName:         location.areaName,
    floor:            location.floor,
    surveyNotes:      location.surveyNotes ?? null,
    notes:            null,
    mountingLocation: null,
    coveragePurpose:  null,
    surveyedAt:       location.surveyedAt ? new Date(location.surveyedAt).toISOString() : new Date().toISOString(),
    cameraModel:      null,
    accessMethod:     location.accessMethod ?? null,
    images,
  }, { status: 201 });
}
