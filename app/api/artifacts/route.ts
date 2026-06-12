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

// GET /api/artifacts?typeId=&includeInactive=
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const typeId          = searchParams.get('typeId');
  const includeInactive = searchParams.get('includeInactive') === 'true';

  try {
    const artifacts = await prisma.artifactModel.findMany({
      where: {
        ...(typeId ? { artifactTypeId: Number(typeId) } : {}),
        ...(includeInactive ? {} : { active: true }),
      },
      include: { artifactType: { select: { id: true, name: true } } },
      orderBy: [
        { artifactType: { sortOrder: 'asc' } },
        { manufacturer: 'asc' },
        { modelName: 'asc' },
      ],
    });
    return NextResponse.json(artifacts);
  } catch (err) {
    console.error('[GET /api/artifacts]', err);
    return NextResponse.json({ error: 'Failed to load artifacts' }, { status: 500 });
  }
}

// POST /api/artifacts — admin only
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const b = await req.json();
    if (!b.artifactTypeId) {
      return NextResponse.json({ error: 'Artifact type is required' }, { status: 400 });
    }

    const artifact = await prisma.artifactModel.create({
      data: {
        artifactTypeId: Number(b.artifactTypeId),
        manufacturer:   b.manufacturer?.trim() || null,
        modelName:      b.modelName?.trim()    || null,
        variant:        b.variant?.trim()      || null,
        description:    b.description?.trim()  || null,
        imageUrl:       b.imageUrl             || null,
        cost:           b.cost !== undefined && b.cost !== null && b.cost !== '' ? Number(b.cost) : null,
        comment:        b.comment?.trim()      || null,
      },
      include: { artifactType: { select: { id: true, name: true } } },
    });
    return NextResponse.json(artifact, { status: 201 });
  } catch (err) {
    console.error('[POST /api/artifacts]', err);
    return NextResponse.json({ error: 'Failed to create artifact' }, { status: 500 });
  }
}
