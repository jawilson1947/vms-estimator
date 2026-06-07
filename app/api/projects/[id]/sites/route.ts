import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/sites  — connect a site to this project
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { siteId } = await req.json();
  if (!siteId) return NextResponse.json({ error: 'siteId is required' }, { status: 400 });

  const site = await prisma.site.findUnique({ where: { id: Number(siteId) } });
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  await prisma.$executeRaw(
    Prisma.sql`INSERT IGNORE INTO _SiteProjects (A, B) VALUES (${Number(id)}, ${Number(siteId)})`
  );

  return NextResponse.json({ success: true }, { status: 201 });
}
