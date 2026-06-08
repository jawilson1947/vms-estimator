import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { put } from '@vercel/blob';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];
const MAX_BYTES     = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Could not parse form data.' }, { status: 400 });
    }

    const file = formData.get('file') as File | null;
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. PNG, JPG, GIF, WebP or SVG only.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 2 MB).' }, { status: 400 });
    }

    const userId   = Number((session.user as { id?: string | number }).id ?? 0);
    const ext      = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const filename = `logos/logo-${userId}-${Date.now()}.${ext}`;

    const blob = await put(filename, file, {
      access: 'public',
      contentType: file.type,
    });

    await prisma.user.update({
      where: { id: userId },
      data:  { logoUrl: blob.url },
    });

    return NextResponse.json({ logoUrl: blob.url });
  } catch (err: unknown) {
    console.error('[POST /api/user/logo]', err);
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
