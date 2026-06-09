import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ─── POST: copy or move ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    action: 'copy' | 'move';
    locationIds: number[];
    targetProjectId: number;
  };

  const { action, locationIds, targetProjectId } = body;

  if (!action || !['copy', 'move'].includes(action))
    return NextResponse.json({ error: 'action must be "copy" or "move"' }, { status: 400 });
  if (!Array.isArray(locationIds) || locationIds.length === 0)
    return NextResponse.json({ error: 'locationIds must be a non-empty array' }, { status: 400 });
  if (!targetProjectId || isNaN(Number(targetProjectId)))
    return NextResponse.json({ error: 'targetProjectId is required' }, { status: 400 });

  const targetProject = await prisma.project.findUnique({ where: { id: Number(targetProjectId) } });
  if (!targetProject) return NextResponse.json({ error: 'Target project not found' }, { status: 404 });

  // ── Move ──────────────────────────────────────────────────────────────────

  if (action === 'move') {
    const result = await prisma.cameraLocation.updateMany({
      where: { id: { in: locationIds.map(Number) } },
      data:  { projectId: Number(targetProjectId) },
    });
    return NextResponse.json({ moved: result.count });
  }

  // ── Copy ──────────────────────────────────────────────────────────────────

  const sources = await prisma.cameraLocation.findMany({
    where:   { id: { in: locationIds.map(Number) } },
    include: { images: true },
  });

  if (sources.length === 0)
    return NextResponse.json({ error: 'No matching locations found' }, { status: 404 });

  const created = await prisma.$transaction(async (tx) => {
    const results: number[] = [];

    for (const loc of sources) {
      const newLoc = await tx.cameraLocation.create({
        data: {
          projectId:       Number(targetProjectId),
          cameraModelId:   loc.cameraModelId,
          floor:           loc.floor,
          areaName:        loc.areaName,
          mountingLocation: loc.mountingLocation,
          coveragePurpose: loc.coveragePurpose,
          notes:           loc.notes,
          surveyNotes:     loc.surveyNotes,
          // surveyedAt intentionally omitted — copy starts as un-surveyed
        },
      });

      // Copy image metadata records pointing to the same blob URLs
      if (loc.images.length > 0) {
        await tx.cameraLocationImage.createMany({
          data: loc.images.map(img => ({
            locationId:      newLoc.id,
            imageType:       img.imageType,
            fileName:        img.fileName,
            originalFileName: img.originalFileName,
            filePath:        img.filePath,
            fileUrl:         img.fileUrl,
            mimeType:        img.mimeType,
            fileSizeBytes:   img.fileSizeBytes,
            description:     img.description,
            uploadedBy:      (session.user as { email?: string })?.email ?? null,
          })),
        });
      }

      results.push(newLoc.id);
    }

    return results;
  });

  return NextResponse.json({ copied: created.length, newLocationIds: created });
}

// ─── DELETE: bulk delete ───────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { locationIds: number[] };
  const { locationIds } = body;

  if (!Array.isArray(locationIds) || locationIds.length === 0)
    return NextResponse.json({ error: 'locationIds must be a non-empty array' }, { status: 400 });

  // Images cascade-delete automatically via onDelete: Cascade
  const result = await prisma.cameraLocation.deleteMany({
    where: { id: { in: locationIds.map(Number) } },
  });

  return NextResponse.json({ deleted: result.count });
}
