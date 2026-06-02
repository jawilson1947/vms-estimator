import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { put } from '@vercel/blob';

// POST /api/cameras/upload-image
// Accepts a multipart form with field "image", uploads to Vercel Blob, returns { url }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('image') as File | null;
  if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

  const ext      = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const fileName = `camera-model-${Date.now()}.${ext}`;

  const blob = await put(`camera-models/${fileName}`, file, {
    access: 'public',
    contentType: file.type || `image/${ext}`,
  });

  return NextResponse.json({ url: blob.url }, { status: 201 });
}
