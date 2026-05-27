import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';
import path from 'path';

type Params = { params: Promise<{ id: string; planId: string }> };

// DELETE /api/buildings/[id]/floor-plans/[planId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { planId: planIdStr } = await params;
  const planId = parseInt(planIdStr);
  if (isNaN(planId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const rows = await prisma.$queryRaw<{ file_path: string }[]>`
    SELECT file_path FROM building_floor_plans WHERE plan_id = ${planId} LIMIT 1
  `;
  if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Delete file from disk (best-effort)
  try {
    await unlink(path.join(process.cwd(), 'public', rows[0].file_path));
  } catch { /* already gone */ }

  await prisma.$executeRaw`DELETE FROM building_floor_plans WHERE plan_id = ${planId}`;

  return NextResponse.json({ ok: true });
}
