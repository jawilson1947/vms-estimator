import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

type Params = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  if ((session.user as any)?.role !== 'ADMIN') return null;
  return session;
}

// PUT /api/admin/users/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const b = await req.json();

  const data: any = {
    firstName: b.firstName || null,
    lastName:  b.lastName  || null,
    email:     b.email     || undefined,
    username:  b.username  || undefined,
    role:      b.role      ? (b.role as UserRole) : undefined,
    isActive:  b.isActive !== undefined ? !!b.isActive : undefined,
  };

  // Optional password reset
  if (b.password) {
    data.passwordHash = await bcrypt.hash(b.password, 10);
  }

  // Clean up undefined keys
  Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

  const user = await prisma.user.update({
    where: { id: Number(id) },
    data,
    select: {
      id: true, firstName: true, lastName: true,
      username: true, email: true, role: true,
      isActive: true, lastLogin: true, createdAt: true,
    },
  });

  return NextResponse.json(user);
}

// DELETE /api/admin/users/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const currentUser = (session.user as any);
  if (currentUser?.id === Number(id)) {
    return NextResponse.json({ error: 'Cannot delete your own account.' }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: Number(id) } });
  return NextResponse.json({ success: true });
}
