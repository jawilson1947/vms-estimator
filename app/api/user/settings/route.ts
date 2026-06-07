import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/user/settings
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: {
      companyName:           true,
      companyTagline:        true,
      logoUrl:               true,
      companyPhone:          true,
      companyAddress:        true,
      companyWebsite:        true,
      defaultProjectManager: true,
    },
  });

  return NextResponse.json(user ?? {});
}

// PATCH /api/user/settings
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const {
    companyName, companyTagline, logoUrl,
    companyPhone, companyAddress, companyWebsite,
    defaultProjectManager,
  } = await req.json();

  const updated = await prisma.user.update({
    where: { id: userId },
    data:  {
      companyName:           companyName           || null,
      companyTagline:        companyTagline         || null,
      logoUrl:               logoUrl               || null,
      companyPhone:          companyPhone           || null,
      companyAddress:        companyAddress         || null,
      companyWebsite:        companyWebsite         || null,
      defaultProjectManager: defaultProjectManager || null,
    },
    select: {
      companyName: true, companyTagline: true, logoUrl: true,
      companyPhone: true, companyAddress: true, companyWebsite: true,
      defaultProjectManager: true,
    },
  });

  return NextResponse.json(updated);
}
