import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { put } from '@vercel/blob';

// POST /api/survey/locations/[id]/photos
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const locationId = parseInt(idStr);
  if (isNaN(locationId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const formData = await req.formData();
  const file = formData.get('photo') as File | null;
  const description = (formData.get('caption') as string) ?? '';

  if (!file) return NextResponse.json({ error: 'No photo provided' }, { status: 400 });

  const ext      = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const fileName = `survey-${locationId}-${Date.now()}.${ext}`;

  // Upload to Vercel Blob
  const blob = await put(`survey/${fileName}`, file, {
    access: 'public',
    contentType: file.type || `image/${ext}`,
  });

  const image = await prisma.cameraLocationImage.create({
    data: {
      locationId,
      fileName,
      filePath:         blob.url,
      fileUrl:          blob.url,
      originalFileName: file.name,
      mimeType:         file.type || `image/${ext}`,
      fileSizeBytes:    BigInt(file.size),
      description:      description || null,
      imageType:        'SITE_SURVEY',
      uploadedBy:       session.user?.email ?? 'unknown',
    },
  });

  // Mark location as surveyed via raw SQL
  try {
    await prisma.$executeRaw`
      UPDATE camera_locations SET surveyed_at = NOW() WHERE location_id = ${locationId}
    `;
  } catch { /* column may not exist yet */ }

  return NextResponse.json({
    id:        image.id,
    imageUrl:  blob.url,
    caption:   description || null,
    createdAt: image.uploadedAt.toISOString(),
  }, { status: 201 });
}
