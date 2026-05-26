import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/audit?page=1&limit=50&action=&userId=
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1'));
  const limit  = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') ?? '50')));
  const action = searchParams.get('action') ?? '';
  const userId = searchParams.get('userId') ? parseInt(searchParams.get('userId')!) : undefined;
  const entity = searchParams.get('entity') ?? '';

  const where: Record<string, any> = {};
  if (action) where.action = { contains: action };
  if (userId) where.userId = userId;
  if (entity) where.entityType = entity;

  const [logs, total] = await Promise.all([
    (prisma as any).auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:  (page - 1) * limit,
      take:  limit,
      include: {
        user: { select: { username: true, firstName: true, lastName: true } },
      },
    }),
    (prisma as any).auditLog.count({ where }),
  ]);

  // Serialise dates
  const serialised = logs.map((l: any) => ({
    ...l,
    createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : l.createdAt,
  }));

  return NextResponse.json({ logs: serialised, total, page, limit });
}
