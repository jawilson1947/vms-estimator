import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';

type Params = { params: Promise<{ id: string }> };

// DELETE /api/camera-images/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const imageId = Number(id);
  const image = await prisma.cameraLocationImage.findUnique({ where: { id: imageId } });
  if (!image) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Attempt to delete file from disk (best effort)
  try { await unlink(image.filePath); } catch (_) { /* already gone */ }

  await prisma.cameraLocationImage.delete({ where: { id: imageId } });
  return NextResponse.json({ success: true });
}
