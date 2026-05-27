import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';
import path from 'path';

// DELETE /api/survey/locations/[id]/photos/[photoId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { photoId: photoIdStr } = await params;
  const photoId = parseInt(photoIdStr);
  if (isNaN(photoId)) return NextResponse.json({ error: 'Invalid photo ID' }, { status: 400 });

  // Load the image record so we can delete the file too
  const image = await prisma.cameraLocationImage.findUnique({ where: { id: photoId } });
  if (!image) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });

  // Delete DB record
  await prisma.cameraLocationImage.delete({ where: { id: photoId } });

  // Delete file from disk (best-effort — don't fail the request if missing)
  try {
    const filePath = path.join(process.cwd(), 'public', image.filePath);
    await unlink(filePath);
  } catch { /* file may already be gone */ }

  return NextResponse.json({ ok: true });
}
