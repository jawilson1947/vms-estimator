import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];
const MAX_BYTES     = 2 * 1024 * 1024; // 2 MB

// POST /api/user/logo  — multipart upload, returns { logoUrl }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. PNG, JPG, GIF, WebP or SVG only.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 2 MB).' }, { status: 400 });
  }

  const userId   = Number((session.user as { id?: string | number }).id ?? 0);
  const ext      = file.name.split('.').pop()?.toLowerCase() ?? 'png';
  const filename = `logo-${userId}-${Date.now()}.${ext}`;
  const uploadDir = join(process.cwd(), 'public', 'uploads', 'logos');

  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));

  const logoUrl = `/uploads/logos/${filename}`;

  await prisma.user.update({
    where: { id: userId },
    data:  { logoUrl },
  });

  return NextResponse.json({ logoUrl });
}
