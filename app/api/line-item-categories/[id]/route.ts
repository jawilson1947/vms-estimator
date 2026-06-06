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

// PUT /api/line-item-categories/[id] — admin only
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const b = await req.json();
  if (!b.name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  try {
    const category = await prisma.lineItemCategory.update({
      where: { id: Number(id) },
      data: {
        name: b.name.trim(),
        ...(b.sortOrder !== undefined && { sortOrder: Number(b.sortOrder) }),
      },
    });
    return NextResponse.json(category);
  } catch (err: any) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    if (err.code === 'P2002') return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
    console.error('[PUT /api/line-item-categories/[id]]', err);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

// DELETE /api/line-item-categories/[id] — admin only
// Soft-deletes if referenced by any ProjectCost; hard-deletes otherwise.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  try {
    const inUse = await prisma.projectCost.count({ where: { categoryId: Number(id) } });
    if (inUse > 0) {
      await prisma.lineItemCategory.update({
        where: { id: Number(id) },
        data:  { active: false },
      });
      return NextResponse.json({ softDeleted: true });
    }
    await prisma.lineItemCategory.delete({ where: { id: Number(id) } });
    return NextResponse.json({ softDeleted: false });
  } catch (err: any) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    console.error('[DELETE /api/line-item-categories/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
