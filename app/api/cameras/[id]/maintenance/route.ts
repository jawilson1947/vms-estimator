import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: { id: string } };

// GET /api/cameras/[id]/maintenance
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const records = await prisma.maintenanceRecord.findMany({
    where:   { cameraId: Number(params.id) },
    orderBy: { serviceDate: 'desc' },
  });

  return NextResponse.json(records);
}

// POST /api/cameras/[id]/maintenance
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await req.json();
  const record = await prisma.maintenanceRecord.create({
    data: {
      cameraId:        Number(params.id),
      serviceDate:     new Date(b.serviceDate),
      serviceType:     b.serviceType     || null,
      technician:      b.technician      || null,
      issueFound:      b.issueFound      || null,
      correctiveAction:b.correctiveAction|| null,
      nextServiceDue:  b.nextServiceDue  ? new Date(b.nextServiceDue) : null,
    },
  });

  return NextResponse.json(record, { status: 201 });
}
