import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

type Params = { params: Promise<{ id: string }> };

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

// GET /api/cameras/[id]/images
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const images = await prisma.cameraLocationImage.findMany({
    where: { cameraId: Number(id) },
    orderBy: { uploadedAt: 'desc' },
  });

  return NextResponse.json(
    images.map(img => ({
      ...img,
      fileSizeBytes: img.fileSizeBytes ? Number(img.fileSizeBytes) : null,
    }))
  );
}

// POST /api/cameras/[id]/images  — multipart upload
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cameraId = Number(id);

  // Verify camera exists
  const camera = await prisma.camera.findUnique({ where: { id: cameraId } });
  if (!camera) return NextResponse.json({ error: 'Camera not found' }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const imageType = (formData.get('imageType') as string) || 'Other';
  const description = (formData.get('description') as string) || null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File type not allowed. Use JPG, PNG, or PDF.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File exceeds 25 MB limit.' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Build a unique filename: timestamp + sanitised original name
  const ext = path.extname(file.name) || '.bin';
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'cameras', String(cameraId));
  await mkdir(uploadDir, { recursive: true });

  const diskPath = path.join(uploadDir, safeName);
  await writeFile(diskPath, buffer);

  const fileUrl = `/uploads/cameras/${cameraId}/${safeName}`;
  const filePath = diskPath;

  const image = await prisma.cameraLocationImage.create({
    data: {
      cameraId,
      imageType:        imageType as any,
      fileName:         safeName,
      originalFileName: file.name,
      filePath,
      fileUrl,
      mimeType:         file.type,
      fileSizeBytes:    BigInt(file.size),
      description,
      uploadedBy:       session.user?.name ?? session.user?.email ?? 'unknown',
    },
  });

  return NextResponse.json({
    ...image,
    fileSizeBytes: image.fileSizeBytes ? Number(image.fileSizeBytes) : null,
  }, { status: 201 });
}
