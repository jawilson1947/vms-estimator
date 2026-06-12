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

// GET /api/access-methods — active methods with their default BOM items
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const methods = await prisma.accessMethod.findMany({
      where:   { active: true },
      include: {
        items: {
          include: { artifactType: { select: { id: true, name: true } } },
          orderBy: { artifactType: { sortOrder: 'asc' } },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return NextResponse.json(methods);
  } catch (err) {
    console.error('[GET /api/access-methods]', err);
    return NextResponse.json({ error: 'Failed to load access methods' }, { status: 500 });
  }
}

// POST /api/access-methods — admin only
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const b = await req.json();
    if (!b.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const existing = await prisma.accessMethod.findUnique({ where: { name: b.name.trim() } });
    if (existing) {
      return NextResponse.json({ error: 'An access method with this name already exists' }, { status: 409 });
    }

    const agg = await prisma.accessMethod.aggregate({ _max: { sortOrder: true } });
    const method = await prisma.accessMethod.create({
      data: {
        name:      b.name.trim(),
        grouping:  b.grouping?.trim() || null,
        sortOrder: (agg._max.sortOrder ?? 0) + 1,
        items: Array.isArray(b.items) && b.items.length > 0
          ? {
              create: b.items.map((i: any) => ({
                artifactTypeId: Number(i.artifactTypeId),
                quantity:       Number(i.quantity) || 1,
                notes:          i.notes?.trim() || null,
              })),
            }
          : undefined,
      },
      include: { items: { include: { artifactType: { select: { id: true, name: true } } } } },
    });
    return NextResponse.json(method, { status: 201 });
  } catch (err) {
    console.error('[POST /api/access-methods]', err);
    return NextResponse.json({ error: 'Failed to create access method' }, { status: 500 });
  }
}
