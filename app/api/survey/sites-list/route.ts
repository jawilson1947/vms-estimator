import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/survey/sites-list — lightweight list for voice command building-name matching
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json([], { status: 401 });

  const sites = await prisma.site.findMany({
    orderBy: { siteName: 'asc' },
    select: {
      id: true,
      siteName: true,
      buildings: {
          orderBy: { buildingName: 'asc' },
          select: {
            id: true,
            buildingName: true,
            projects: {
              orderBy: { projectName: 'asc' },
              select: { id: true, projectName: true },
            },
          },
        },
    },
  });

  return NextResponse.json(sites);
}
