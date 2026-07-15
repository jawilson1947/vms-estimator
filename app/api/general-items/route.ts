import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  if ((session.user as { role?: UserRole })?.role !== UserRole.ADMIN) return null;
  return session;
}

// GET /api/general-items — active catalog items (pass ?all=1 for admin management view)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const all = req.nextUrl.searchParams.get('all') === '1';
  try {
    const items = await prisma.generalItem.findMany({
      where:   all ? undefined : { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return NextResponse.json(items);
  } catch (err) {
    console.error('[GET /api/general-items]', err);
    return NextResponse.json({ error: 'Failed to load general items' }, { status: 500 });
  }
}

// POST /api/general-items — admin only
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const b = await req.json();
    if (!b.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const existing = await prisma.generalItem.findUnique({ where: { name: b.name.trim() } });
    if (existing) {
      return NextResponse.json({ error: 'An item with this name already exists' }, { status: 409 });
    }

    const agg = await prisma.generalItem.aggregate({ _max: { sortOrder: true } });
    const item = await prisma.generalItem.create({
      data: {
        name:        b.name.trim(),
        description: b.description?.trim() || null,
        cost:        Number(b.cost) || 0,
        defaultQty:  Number(b.defaultQty) || 1,
        sortOrder:   (agg._max.sortOrder ?? 0) + 1,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('[POST /api/general-items]', err);
    return NextResponse.json({ error: 'Failed to create general item' }, { status: 500 });
  }
}
