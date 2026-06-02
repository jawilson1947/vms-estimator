import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const body = await req.json();
  const {
    areaName, floor, buildingId, surveyNotes, notes,
    mountingLocation, coveragePurpose, markSurveyed,
    cameraModelId,
  } = body;

  const updateData: Record<string, unknown> = {};
  if (areaName         !== undefined) updateData.areaName         = areaName;
  if (floor            !== undefined) updateData.floor            = floor;
  if (buildingId       !== undefined) updateData.buildingId       = parseInt(String(buildingId), 10);
  if (notes            !== undefined) updateData.notes            = notes;
  if (mountingLocation !== undefined) updateData.mountingLocation = mountingLocation;
  if (coveragePurpose  !== undefined) updateData.coveragePurpose  = coveragePurpose;

  // Direct model assignment — null clears it
  if (cameraModelId !== undefined) {
    updateData.cameraModelId = typeof cameraModelId === 'number' ? cameraModelId : null;
  }

  const location = await prisma.cameraLocation.update({
    where: { id },
    data:  Object.keys(updateData).length ? updateData : { id },
    include: {
      cameraModel: {
        select: {
          id:              true,
          manufacturer:    true,
          model:           true,
          cameraType:      true,
          resolution:      true,
          resolutionClass: true,
          imageUrl:        true,
          ptz:             true,
          indoorOutdoor:   true,
        },
      },
      images: {
        where:  { imageType: 'SITE_SURVEY' },
        select: { id: true, fileUrl: true, description: true, uploadedAt: true },
      },
    },
  });

  let surveyedAtValue: string | null = null;
  let surveyNotesValue: string | null = null;
  try {
    if (surveyNotes !== undefined || markSurveyed) {
      await prisma.$executeRaw`
        UPDATE camera_locations
        SET    survey_notes = COALESCE(${surveyNotes ?? null}, survey_notes),
               surveyed_at  = ${markSurveyed ? new Date() : null}
        WHERE  location_id  = ${id}
      `;
    }
    const rows = await prisma.$queryRaw<{ survey_notes: string | null; surveyed_at: Date | null }[]>`
      SELECT survey_notes, surveyed_at FROM camera_locations WHERE location_id = ${id}
    `;
    if (rows[0]) {
      surveyNotesValue = rows[0].survey_notes;
      surveyedAtValue  = rows[0].surveyed_at ? new Date(rows[0].surveyed_at).toISOString() : null;
    }
  } catch { /* columns may not exist yet */ }

  return NextResponse.json({
    id:              location.id,
    buildingId:      location.buildingId,
    areaName:        location.areaName,
    floor:           location.floor,
    surveyNotes:     surveyNotesValue,
    notes:           location.notes,
    mountingLocation:location.mountingLocation,
    coveragePurpose: location.coveragePurpose,
    surveyedAt:      surveyedAtValue,
    cameraModel:     location.cameraModel ?? null,
    images: location.images.map(img => ({
      id:        img.id,
      imageUrl:  img.fileUrl ?? '',
      caption:   img.description ?? null,
      createdAt: img.uploadedAt.toISOString(),
    })),
  });
}

// DELETE /api/survey/locations/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  await prisma.cameraLocation.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
