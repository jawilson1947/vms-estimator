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

const SELECT = {
  id: true, firstName: true, lastName: true,
  username: true, email: true, phone: true, role: true,
  isActive: true, lastLogin: true, createdAt: true,
} as const;

// PATCH /api/admin/users/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const b = await req.json();

  const data: Record<string, unknown> = {};
  if (b.firstName  !== undefined) data.firstName = b.firstName  || null;
  if (b.lastName   !== undefined) data.lastName  = b.lastName   || null;
  if (b.phone      !== undefined) data.phone     = b.phone      || null;
  if (b.email      !== undefined) data.email     = b.email;
  if (b.username   !== undefined) data.username  = b.username;
  if (b.role       !== undefined) data.role      = b.role as UserRole;
  if (b.isActive   !== undefined) data.isActive  = !!b.isActive;

  const user = await prisma.user.update({
    where: { id: Number(id) },
    data,
    select: SELECT,
  });

  return NextResponse.json(user);
}

// DELETE /api/admin/users/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = Number(id);
  const currentUserId = Number((session.user as any)?.id);

  if (currentUserId === userId) {
    return NextResponse.json({ error: 'Cannot delete your own account.' }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (target?.role === UserRole.ADMIN) {
    const adminCount = await prisma.user.count({ where: { role: UserRole.ADMIN, isActive: true } });
    if (adminCount <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last administrator.' }, { status: 400 });
    }
  }

  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ success: true });
}
