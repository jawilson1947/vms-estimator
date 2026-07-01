import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  if ((session.user as { role?: string })?.role !== UserRole.ADMIN) return null;
  return session;
}

// GET /api/admin/users/[id]/projects
// Returns the full project list plus the ids currently granted to this user.
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const userId = Number(id);

  const [projects, grants] = await Promise.all([
    prisma.project.findMany({
      orderBy: { projectName: 'asc' },
      select: {
        id: true, projectName: true, projectNumber: true,
        customer: { select: { customerName: true } },
      },
    }),
    prisma.projectAccess.findMany({ where: { userId }, select: { projectId: true } }),
  ]);

  return NextResponse.json({
    assigned: grants.map(g => g.projectId),
    projects: projects.map(p => ({
      id: p.id,
      projectName: p.projectName,
      projectNumber: p.projectNumber,
      customerName: p.customer.customerName,
    })),
  });
}

// PUT /api/admin/users/[id]/projects  { projectIds: number[] }
// Replaces the user's full set of project grants.
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const userId = Number(id);

  const body = await req.json().catch(() => ({})) as { projectIds?: unknown };
  const ids = Array.isArray(body.projectIds)
    ? Array.from(new Set(body.projectIds.map(Number).filter(n => Number.isFinite(n))))
    : [];

  // Only keep ids that reference real projects.
  const valid = ids.length
    ? (await prisma.project.findMany({ where: { id: { in: ids } }, select: { id: true } })).map(p => p.id)
    : [];

  await prisma.$transaction([
    prisma.projectAccess.deleteMany({ where: { userId } }),
    ...(valid.length
      ? [prisma.projectAccess.createMany({
          data: valid.map(projectId => ({ userId, projectId })),
          skipDuplicates: true,
        })]
      : []),
  ]);

  return NextResponse.json({ assigned: valid });
}
