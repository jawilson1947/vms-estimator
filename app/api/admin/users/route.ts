import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  if ((session.user as any)?.role !== 'ADMIN') return null;
  return session;
}

// GET /api/admin/users
export async function GET(_req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const users = await prisma.user.findMany({
    select: {
      id: true, firstName: true, lastName: true,
      username: true, email: true, role: true,
      isActive: true, lastLogin: true, createdAt: true,
    },
    orderBy: { username: 'asc' },
  });

  return NextResponse.json(users);
}

// POST /api/admin/users — create user
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const b = await req.json();
  if (!b.username || !b.email || !b.password) {
    return NextResponse.json({ error: 'username, email, and password are required.' }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: b.username }, { email: b.email }] },
  });
  if (existing) {
    return NextResponse.json({ error: 'Username or email already in use.' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(b.password, 10);
  const user = await prisma.user.create({
    data: {
      username:     b.username,
      email:        b.email,
      firstName:    b.firstName    || null,
      lastName:     b.lastName     || null,
      passwordHash,
      role:         (b.role as UserRole) || UserRole.VIEWER,
      isActive:     b.isActive !== undefined ? !!b.isActive : true,
    },
    select: {
      id: true, firstName: true, lastName: true,
      username: true, email: true, role: true,
      isActive: true, lastLogin: true, createdAt: true,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
