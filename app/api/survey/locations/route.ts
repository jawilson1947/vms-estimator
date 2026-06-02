import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/survey/locations — quick-create a location during a survey walk
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { buildingId, areaName, floor, surveyNotes } = body;

  if (!buildingId || !areaName) {
    return NextResponse.json({ error: 'buildingId and areaName are required' }, { status: 400 });
  }

  // Create the location using only fields the current Prisma client knows about
  const location = await prisma.cameraLocation.create({
    data: {
      buildingId: parseInt(buildingId),
      areaName,
      floor: floor ?? null,
    },
  });

  // Write survey-specific columns via raw SQL (safe even before prisma generate)
  try {
    await prisma.$executeRaw`
      UPDATE camera_locations
      SET    survey_notes = ${surveyNotes ?? null},
             surveyed_at  = NOW()
      WHERE  location_id  = ${location.id}
    `;
  } catch { /* column may not exist yet — non-fatal */ }

  // Return the full location shape SurveyBoard expects
  const images: { id: number; imageUrl: string; caption: string | null; createdAt: string }[] = [];
  return NextResponse.json({
    id:              location.id,
    buildingId:      location.buildingId,
    areaName:        location.areaName,
    floor:           location.floor,
    surveyNotes:     surveyNotes ?? null,
    notes:           null,
    mountingLocation: null,
    coveragePurpose: null,
    surveyedAt:      new Date().toISOString(),
    cameraModel:     null,
    images,
  }, { status: 201 });
}
