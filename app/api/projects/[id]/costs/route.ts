import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CostCategory } from '@prisma/client';

type Params = { params: { id: string } };

// GET /api/projects/[id]/costs
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const costs = await prisma.projectCost.findMany({
    where:   { projectId: Number(params.id) },
    orderBy: [{ costCategory: 'asc' }, { id: 'asc' }],
  });

  return NextResponse.json(costs);
}

// POST /api/projects/[id]/costs
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await req.json();

  if (!b.costCategory) return NextResponse.json({ error: 'Category is required' }, { status: 400 });

  const cost = await prisma.projectCost.create({
    data: {
      projectId:    Number(params.id),
      costCategory: b.costCategory as CostCategory,
      description:  b.description  || null,
      quantity:     b.quantity     ? Number(b.quantity)     : 1,
      unitCost:     b.unitCost     ? Number(b.unitCost)     : 0,
      markupPercent:b.markupPercent? Number(b.markupPercent): 0,
      // lineTotal is DB-generated — omitted
      vendor:       b.vendor       || null,
      costDate:     b.costDate     ? new Date(b.costDate)   : null,
      billable:     b.billable !== undefined ? !!b.billable : true,
      notes:        b.notes        || null,
    },
  });

  // Re-read to get the DB-computed lineTotal
  const fresh = await prisma.projectCost.findUnique({ where: { id: cost.id } });
  return NextResponse.json(fresh, { status: 201 });
}
