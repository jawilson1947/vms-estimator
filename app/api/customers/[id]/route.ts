import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

// GET /api/customers/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const customer = await prisma.customer.findUnique({
    where: { id: Number(id) },
    include: {
      projects: {
        orderBy: { projectName: 'asc' },
        select: { id: true, projectName: true, projectNumber: true, projectStatus: true, startDate: true },
      },
      sites: {
        orderBy: { siteName: 'asc' },
        select: { id: true, siteName: true, city: true, state: true },
      },
    },
  });

  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(customer);
}

// PUT /api/customers/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { customerName, contactName, contactTitle, phone, email, billingAddress, notes } = body;

  if (!customerName?.trim()) {
    return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
  }

  const customer = await prisma.customer.update({
    where: { id: Number(id) },
    data:  { customerName, contactName, contactTitle, phone, email, billingAddress, notes },
  });

  return NextResponse.json(customer);
}

// DELETE /api/customers/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.customer.delete({ where: { id: Number(id) } });
  return NextResponse.json({ success: true });
}
