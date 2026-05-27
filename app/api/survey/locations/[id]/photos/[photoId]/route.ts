import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { del } from '@vercel/blob';

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

  const image = await prisma.cameraLocationImage.findUnique({ where: { id: photoId } });
  if (!image) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });

  // Delete DB record
  await prisma.cameraLocationImage.delete({ where: { id: photoId } });

  // Delete from Vercel Blob (best-effort)
  try {
    if (image.fileUrl) await del(image.fileUrl);
  } catch { /* already gone */ }

  return NextResponse.json({ ok: true });
}
