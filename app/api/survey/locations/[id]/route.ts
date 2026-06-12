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
    areaName, floor, projectId, surveyNotes, notes,
    mountingLocation, coveragePurpose, markSurveyed,
    cameraModelId, accessMethodId,
  } = body;

  const updateData: Record<string, unknown> = {};
  if (areaName         !== undefined) updateData.areaName         = areaName;
  if (floor            !== undefined) updateData.floor            = floor;
  if (projectId        !== undefined) updateData.projectId        = parseInt(String(projectId), 10);
  if (notes            !== undefined) updateData.notes            = notes;
  if (mountingLocation !== undefined) updateData.mountingLocation = mountingLocation;
  if (coveragePurpose  !== undefined) updateData.coveragePurpose  = coveragePurpose;
  if (surveyNotes      !== undefined) updateData.surveyNotes      = surveyNotes;
  if (markSurveyed)                   updateData.surveyedAt       = new Date();
  if (cameraModelId    !== undefined) {
    updateData.cameraModelId = typeof cameraModelId === 'number' ? cameraModelId : null;
  }
  if (accessMethodId   !== undefined) {
    updateData.accessMethodId = typeof accessMethodId === 'number' ? accessMethodId : null;
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
      accessMethod: { select: { id: true, name: true } },
      images: {
        where:  { imageType: 'SITE_SURVEY' },
        select: { id: true, fileUrl: true, description: true, uploadedAt: true },
      },
    },
  });

  return NextResponse.json({
    id:               location.id,
    projectId:        location.projectId,
    areaName:         location.areaName,
    floor:            location.floor,
    surveyNotes:      location.surveyNotes ?? null,
    notes:            location.notes,
    mountingLocation: location.mountingLocation,
    coveragePurpose:  location.coveragePurpose,
    surveyedAt:       location.surveyedAt ? new Date(location.surveyedAt).toISOString() : null,
    cameraModel:      location.cameraModel ?? null,
    accessMethod:     location.accessMethod ?? null,
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
