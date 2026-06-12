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

// GET /api/artifact-types — all active types (used by pickers and settings)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const types = await prisma.artifactType.findMany({
      where:   { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return NextResponse.json(types);
  } catch (err) {
    console.error('[GET /api/artifact-types]', err);
    return NextResponse.json({ error: 'Failed to load artifact types' }, { status: 500 });
  }
}

// POST /api/artifact-types — admin only
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const b = await req.json();
    if (!b.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const existing = await prisma.artifactType.findUnique({ where: { name: b.name.trim() } });
    if (existing) {
      return NextResponse.json({ error: 'An artifact type with this name already exists' }, { status: 409 });
    }

    const agg = await prisma.artifactType.aggregate({ _max: { sortOrder: true } });
    const type = await prisma.artifactType.create({
      data: {
        name:      b.name.trim(),
        sortOrder: (agg._max.sortOrder ?? 0) + 1,
      },
    });
    return NextResponse.json(type, { status: 201 });
  } catch (err) {
    console.error('[POST /api/artifact-types]', err);
    return NextResponse.json({ error: 'Failed to create artifact type' }, { status: 500 });
  }
}
