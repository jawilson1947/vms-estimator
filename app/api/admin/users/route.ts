import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  if ((session.user as any)?.role !== UserRole.ADMIN) return null;
  return session;
}

// GET /api/admin/users
export async function GET(_req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    // Try with phone column first; fall back if migration not yet applied
    let users;
    try {
      users = await prisma.user.findMany({
        select: {
          id: true, firstName: true, lastName: true,
          username: true, email: true, phone: true, role: true,
          isActive: true, lastLogin: true, createdAt: true,
        },
        orderBy: { username: 'asc' },
      });
    } catch {
      // phone column may not exist yet — omit it
      users = (await prisma.user.findMany({
        select: {
          id: true, firstName: true, lastName: true,
          username: true, email: true, role: true,
          isActive: true, lastLogin: true, createdAt: true,
        },
        orderBy: { username: 'asc' },
      })).map((u: any) => ({ ...u, phone: null }));
    }
    return NextResponse.json(users);
  } catch (err) {
    console.error('[GET /api/admin/users]', err);
    return NextResponse.json({ error: 'Failed to query users' }, { status: 500 });
  }
}

// POST /api/admin/users
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
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
    const data: any = {
      username:     b.username,
      email:        b.email,
      firstName:    b.firstName || null,
      lastName:     b.lastName  || null,
      passwordHash,
      role:         (b.role as UserRole) || UserRole.VIEWER,
      isActive:     b.isActive !== undefined ? !!b.isActive : true,
    };
    // Only include phone if the migration has been applied
    if (b.phone !== undefined) {
      try { data.phone = b.phone || null; } catch { /* ignore */ }
    }

    const user = await prisma.user.create({
      data,
      select: {
        id: true, firstName: true, lastName: true,
        username: true, email: true, role: true,
        isActive: true, lastLogin: true, createdAt: true,
      },
    });

    return NextResponse.json({ ...user, phone: b.phone || null }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/admin/users]', err);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
