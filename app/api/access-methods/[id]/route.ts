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

// PUT /api/access-methods/[id] — admin only; replaces BOM items when provided
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const methodId = Number(id);
  const b = await req.json();
  if (!b.name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  try {
    const method = await prisma.$transaction(async tx => {
      if (Array.isArray(b.items)) {
        await tx.accessMethodItem.deleteMany({ where: { accessMethodId: methodId } });
        if (b.items.length > 0) {
          await tx.accessMethodItem.createMany({
            data: b.items.map((i: any) => ({
              accessMethodId: methodId,
              artifactTypeId: Number(i.artifactTypeId),
              quantity:       Number(i.quantity) || 1,
              notes:          i.notes?.trim() || null,
            })),
          });
        }
      }
      return tx.accessMethod.update({
        where: { id: methodId },
        data: {
          name:     b.name.trim(),
          grouping: b.grouping?.trim() || null,
          ...(b.sortOrder !== undefined && { sortOrder: Number(b.sortOrder) }),
        },
        include: {
          items: {
            include: { artifactType: { select: { id: true, name: true } } },
            orderBy: { artifactType: { sortOrder: 'asc' } },
          },
        },
      });
    });
    return NextResponse.json(method);
  } catch (err: any) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Access method not found' }, { status: 404 });
    if (err.code === 'P2002') return NextResponse.json({ error: 'An access method with this name already exists' }, { status: 409 });
    console.error('[PUT /api/access-methods/[id]]', err);
    return NextResponse.json({ error: 'Failed to update access method' }, { status: 500 });
  }
}

// DELETE /api/access-methods/[id] — admin only
// Soft-deletes if referenced by survey locations; hard-deletes otherwise.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const methodId = Number(id);

  try {
    const inUse = await prisma.cameraLocation.count({ where: { accessMethodId: methodId } });
    if (inUse > 0) {
      await prisma.accessMethod.update({
        where: { id: methodId },
        data:  { active: false },
      });
      return NextResponse.json({ softDeleted: true });
    }
    await prisma.accessMethod.delete({ where: { id: methodId } });
    return NextResponse.json({ softDeleted: false });
  } catch (err: any) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Access method not found' }, { status: 404 });
    console.error('[DELETE /api/access-methods/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete access method' }, { status: 500 });
  }
}
