import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/customers — list all customers
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') ?? '';

  const customers = await prisma.customer.findMany({
    where: search
      ? {
          OR: [
            { customerName:   { contains: search } },
            { contactName:    { contains: search } },
            { email:          { contains: search } },
          ],
        }
      : undefined,
    include: {
      _count: { select: { projects: true } },
    },
    orderBy: { customerName: 'asc' },
  });

  return NextResponse.json(customers);
}

// POST /api/customers — create a customer
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { customerName, contactName, contactTitle, phone, email, billingAddress, notes } = body;

  if (!customerName?.trim()) {
    return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
  }

  const customer = await prisma.customer.create({
    data: { customerName, contactName, contactTitle, phone, email, billingAddress, notes },
  });

  return NextResponse.json(customer, { status: 201 });
}
