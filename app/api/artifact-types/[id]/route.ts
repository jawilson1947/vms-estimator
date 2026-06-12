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

// PUT /api/artifact-types/[id] — admin only
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const b = await req.json();
  if (!b.name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  try {
    const type = await prisma.artifactType.update({
      where: { id: Number(id) },
      data: {
        name: b.name.trim(),
        ...(b.sortOrder !== undefined && { sortOrder: Number(b.sortOrder) }),
      },
    });
    return NextResponse.json(type);
  } catch (err: any) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Artifact type not found' }, { status: 404 });
    if (err.code === 'P2002') return NextResponse.json({ error: 'An artifact type with this name already exists' }, { status: 409 });
    console.error('[PUT /api/artifact-types/[id]]', err);
    return NextResponse.json({ error: 'Failed to update artifact type' }, { status: 500 });
  }
}

// DELETE /api/artifact-types/[id] — admin only
// Soft-deletes if referenced by artifacts, method items, or costs; hard-deletes otherwise.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const typeId = Number(id);

  try {
    const [artifacts, methodItems, costs] = await Promise.all([
      prisma.artifactModel.count({ where: { artifactTypeId: typeId } }),
      prisma.accessMethodItem.count({ where: { artifactTypeId: typeId } }),
      prisma.projectCost.count({ where: { artifactTypeId: typeId } }),
    ]);
    if (artifacts + methodItems + costs > 0) {
      await prisma.artifactType.update({
        where: { id: typeId },
        data:  { active: false },
      });
      return NextResponse.json({ softDeleted: true });
    }
    await prisma.artifactType.delete({ where: { id: typeId } });
    return NextResponse.json({ softDeleted: false });
  } catch (err: any) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Artifact type not found' }, { status: 404 });
    console.error('[DELETE /api/artifact-types/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete artifact type' }, { status: 500 });
  }
}
