import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

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

  // Save to public/uploads/survey/
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'survey');
  await mkdir(uploadDir, { recursive: true });

  const ext      = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const fileName = `survey-${locationId}-${Date.now()}.${ext}`;
  const filePath = path.join('uploads', 'survey', fileName);
  const fileUrl  = `/uploads/survey/${fileName}`;

  const bytes = await file.arrayBuffer();
  await writeFile(path.join(process.cwd(), 'public', filePath), Buffer.from(bytes));

  const image = await prisma.cameraLocationImage.create({
    data: {
      locationId,
      fileName,
      filePath,
      fileUrl,
      originalFileName: file.name,
      mimeType: file.type || `image/${ext}`,
      fileSizeBytes: BigInt(file.size),
      description: description || null,
      imageType: 'SITE_SURVEY',
      uploadedBy: session.user?.email ?? 'unknown',
    },
  });

  // Mark location as surveyed via raw SQL (safe before prisma generate)
  try {
    await prisma.$executeRaw`
      UPDATE camera_locations SET surveyed_at = NOW() WHERE location_id = ${locationId}
    `;
  } catch { /* column may not exist yet */ }

  return NextResponse.json({
    id:        image.id,
    imageUrl:  fileUrl,
    caption:   description || null,
    createdAt: image.uploadedAt.toISOString(),
  }, { status: 201 });
}
