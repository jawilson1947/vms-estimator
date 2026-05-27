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
    areaName, floor, surveyNotes, notes, mountingLocation, coveragePurpose, markSurveyed,
    cameraId, cameraModelId,
  } = body;

  if (cameraId !== undefined || cameraModelId !== undefined) {
    await prisma.camera.updateMany({
      where: { locationId: id },
      data: { locationId: null },
    });

    if (typeof cameraId === 'number') {
      await prisma.camera.update({
        where: { id: cameraId },
        data: { locationId: id },
      });
    } else if (typeof cameraModelId === 'number') {
      const model = await prisma.cameraModel.findUnique({ where: { id: cameraModelId } });
      const label = model
        ? [model.manufacturer, model.modelNumber].filter(Boolean).join(' ').trim() || 'Camera'
        : 'Camera';
      const code = 'PLAN-' + String(id) + '-' + String(Date.now());
      await prisma.camera.create({
        data: {
          cameraCode: code,
          cameraName: label,
          modelId: cameraModelId,
          locationId: id,
          status: 'PLANNED',
        },
      });
    }
  }

  const knownData: Record<string, unknown> = {};
  if (areaName !== undefined) knownData.areaName = areaName;
  if (floor !== undefined) knownData.floor = floor;
  if (notes !== undefined) knownData.notes = notes;
  if (mountingLocation !== undefined) knownData.mountingLocation = mountingLocation;
  if (coveragePurpose !== undefined) knownData.coveragePurpose = coveragePurpose;

  const location = await prisma.cameraLocation.update({
    where: { id },
    data: Object.keys(knownData).length ? knownData : { id },
    include: {
      cameras: {
        select: {
          id: true,
          cameraCode: true,
          cameraName: true,
          status: true,
          locationId: true,
          model: { select: { manufacturer: true, modelNumber: true, cameraType: true } },
        },
      },
      images: {
        where: { imageType: 'SITE_SURVEY' },
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
      surveyedAtValue = rows[0].surveyed_at ? new Date(rows[0].surveyed_at).toISOString() : null;
    }
  } catch { /* columns may not exist yet */ }

  return NextResponse.json({
    id: location.id,
    buildingId: location.buildingId,
    areaName: location.areaName,
    floor: location.floor,
    surveyNotes: surveyNotesValue,
    notes: location.notes,
    mountingLocation: location.mountingLocation,
    coveragePurpose: location.coveragePurpose,
    surveyedAt: surveyedAtValue,
    cameras: location.cameras,
    images: location.images.map(img => ({
      id: img.id,
      imageUrl: img.fileUrl ?? '',
      caption: img.description ?? null,
      createdAt: img.uploadedAt.toISOString(),
    })),
  });
}

// DELETE /api/survey/locations/[id]
// Deletes the location, its camera assignments (unlinks cameras), and its images.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  // Unlink any cameras assigned to this location (don't delete the cameras themselves)
  await prisma.camera.updateMany({
    where: { locationId: id },
    data:  { locationId: null },
  });

  // Delete the location (cascades to CameraLocationImage records via DB constraint)
  await prisma.cameraLocation.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
