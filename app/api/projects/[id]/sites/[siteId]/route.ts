import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

type Params = { params: Promise<{ id: string; siteId: string }> };

// DELETE /api/projects/[id]/sites/[siteId]  — disconnect a site from this project
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, siteId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.$executeRaw(
    Prisma.sql`DELETE FROM _SiteProjects WHERE A = ${Number(id)} AND B = ${Number(siteId)}`
  );

  return NextResponse.json({ success: true });
}
