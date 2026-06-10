import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/survey/sites/[siteId]
// Returns full site with buildings and their projects (no locations).
// Consumed by iOS ProjectListView via APIClient.fetchSite().
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { siteId: siteIdStr } = await params;
  const siteId = parseInt(siteIdStr);
  if (isNaN(siteId)) return NextResponse.json({ error: 'Invalid site ID' }, { status: 400 });

  const site = await prisma.site.findUnique({
    where: { id: siteId },
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

  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  return NextResponse.json(site);
}
