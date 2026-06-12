import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  if ((session.user as any)?.role !== UserRole.ADMIN) return null;
  return session;
}

// PUT /api/artifacts/[id] — admin only
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const b = await req.json();
  if (!b.artifactTypeId) {
    return NextResponse.json({ error: 'Artifact type is required' }, { status: 400 });
  }

  try {
    const artifact = await prisma.artifactModel.update({
      where: { id: Number(id) },
      data: {
        artifactTypeId: Number(b.artifactTypeId),
        manufacturer:   b.manufacturer?.trim() || null,
        modelName:      b.modelName?.trim()    || null,
        variant:        b.variant?.trim()      || null,
        description:    b.description?.trim()  || null,
        imageUrl:       b.imageUrl             || null,
        cost:           b.cost !== undefined && b.cost !== null && b.cost !== '' ? Number(b.cost) : null,
        comment:        b.comment?.trim()      || null,
      },
      include: { artifactType: { select: { id: true, name: true } } },
    });
    return NextResponse.json(artifact);
  } catch (err: any) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    console.error('[PUT /api/artifacts/[id]]', err);
    return NextResponse.json({ error: 'Failed to update artifact' }, { status: 500 });
  }
}

// DELETE /api/artifacts/[id] — admin only
// Soft-deletes if referenced by project costs; hard-deletes otherwise.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const artifactId = Number(id);

  try {
    const inUse = await prisma.projectCost.count({ where: { artifactModelId: artifactId } });
    if (inUse > 0) {
      await prisma.artifactModel.update({
        where: { id: artifactId },
        data:  { active: false },
      });
      return NextResponse.json({ softDeleted: true });
    }
    await prisma.artifactModel.delete({ where: { id: artifactId } });
    return NextResponse.json({ softDeleted: false });
  } catch (err: any) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    console.error('[DELETE /api/artifacts/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete artifact' }, { status: 500 });
  }
}
