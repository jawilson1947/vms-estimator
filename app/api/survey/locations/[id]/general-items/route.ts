import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

// PUT /api/survey/locations/[id]/general-items
// Replaces the location's general-item assignment set.
// Body: { items: [{ generalItemId, quantity, notes? }] }
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const locationId = Number(id);
  if (!locationId || isNaN(locationId))
    return NextResponse.json({ error: 'Invalid location id' }, { status: 400 });

  const location = await prisma.cameraLocation.findUnique({ where: { id: locationId }, select: { id: true } });
  if (!location) return NextResponse.json({ error: 'Location not found' }, { status: 404 });

  const body = await req.json().catch(() => ({})) as {
    items?: { generalItemId: number; quantity: number; notes?: string | null }[];
  };
  const items = Array.isArray(body.items) ? body.items : [];

  // Deduplicate by generalItemId, drop invalid rows
  const clean = new Map<number, { quantity: number; notes: string | null }>();
  for (const i of items) {
    const gid = Number(i.generalItemId);
    const qty = Number(i.quantity);
    if (!gid || isNaN(gid) || !qty || qty <= 0) continue;
    clean.set(gid, { quantity: qty, notes: i.notes?.trim() || null });
  }

  await prisma.$transaction(async (tx) => {
    await tx.locationGeneralItem.deleteMany({ where: { locationId } });
    if (clean.size > 0) {
      await tx.locationGeneralItem.createMany({
        data: Array.from(clean, ([generalItemId, v]) => ({
          locationId,
          generalItemId,
          quantity: v.quantity,
          notes:    v.notes,
        })),
      });
    }
  });

  const saved = await prisma.locationGeneralItem.findMany({
    where:   { locationId },
    include: { generalItem: { select: { id: true, name: true, cost: true } } },
    orderBy: { generalItem: { sortOrder: 'asc' } },
  });

  return NextResponse.json({
    items: saved.map(a => ({
      generalItemId: a.generalItemId,
      name:          a.generalItem.name,
      quantity:      Number(a.quantity),
      notes:         a.notes,
    })),
  });
}
