import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  if ((session.user as { role?: UserRole })?.role !== UserRole.ADMIN) return null;
  return session;
}

// PUT /api/general-items/[id] — admin only
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  try {
    const b = await req.json();
    if (b.name !== undefined && !b.name?.trim()) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    }

    const item = await prisma.generalItem.update({
      where: { id: Number(id) },
      data: {
        ...(b.name        !== undefined ? { name: b.name.trim() } : {}),
        ...(b.description !== undefined ? { description: b.description?.trim() || null } : {}),
        ...(b.cost        !== undefined ? { cost: Number(b.cost) || 0 } : {}),
        ...(b.defaultQty  !== undefined ? { defaultQty: Number(b.defaultQty) || 1 } : {}),
        ...(b.sortOrder   !== undefined ? { sortOrder: Number(b.sortOrder) || 0 } : {}),
        ...(b.active      !== undefined ? { active: !!b.active } : {}),
      },
    });
    return NextResponse.json(item);
  } catch (err) {
    console.error('[PUT /api/general-items/[id]]', err);
    return NextResponse.json({ error: 'Failed to update general item' }, { status: 500 });
  }
}

// DELETE /api/general-items/[id] — admin only; deactivates if in use
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const itemId = Number(id);
  try {
    const inUse = await prisma.locationGeneralItem.count({ where: { generalItemId: itemId } });
    if (inUse > 0) {
      // Preserve history: deactivate instead of deleting
      const item = await prisma.generalItem.update({ where: { id: itemId }, data: { active: false } });
      return NextResponse.json({ deactivated: true, item });
    }
    await prisma.generalItem.delete({ where: { id: itemId } });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('[DELETE /api/general-items/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete general item' }, { status: 500 });
  }
}
