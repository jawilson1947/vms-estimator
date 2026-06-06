import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  if ((session.user as any)?.role !== UserRole.ADMIN) return null;
  return session;
}

// GET /api/line-item-categories — public (used by CostEstimator for all users)
export async function GET() {
  try {
    const categories = await prisma.lineItemCategory.findMany({
      where:   { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return NextResponse.json(categories);
  } catch (err) {
    console.error('[GET /api/line-item-categories]', err);
    return NextResponse.json({ error: 'Failed to load categories' }, { status: 500 });
  }
}

// POST /api/line-item-categories — admin only
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const b = await req.json();
    if (!b.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const existing = await prisma.lineItemCategory.findUnique({ where: { name: b.name.trim() } });
    if (existing) {
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
    }

    const agg = await prisma.lineItemCategory.aggregate({ _max: { sortOrder: true } });
    const category = await prisma.lineItemCategory.create({
      data: {
        name:      b.name.trim(),
        sortOrder: (agg._max.sortOrder ?? 0) + 1,
      },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    console.error('[POST /api/line-item-categories]', err);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
