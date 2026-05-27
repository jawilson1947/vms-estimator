import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

// PUT /api/maintenance/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await req.json();
  const record = await prisma.maintenanceRecord.update({
    where: { id: Number(id) },
    data:  {
      serviceDate:     new Date(b.serviceDate),
      serviceType:     b.serviceType      || null,
      technician:      b.technician       || null,
      issueFound:      b.issueFound       || null,
      correctiveAction:b.correctiveAction || null,
      nextServiceDue:  b.nextServiceDue   ? new Date(b.nextServiceDue) : null,
    },
  });

  return NextResponse.json(record);
}

// DELETE /api/maintenance/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.maintenanceRecord.delete({ where: { id: Number(id) } });
  return NextResponse.json({ success: true });
}
