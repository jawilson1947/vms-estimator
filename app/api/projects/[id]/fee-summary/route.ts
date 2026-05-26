import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: { id: string } };

// GET /api/projects/[id]/fee-summary
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const summary = await prisma.projectFeeSummary.findUnique({
    where: { projectId: Number(params.id) },
  });

  return NextResponse.json(summary ?? null);
}

// PUT /api/projects/[id]/fee-summary — upsert
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectId = Number(params.id);
  const b = await req.json();

  // Recalculate direct cost total from actual line items
  const costs = await prisma.projectCost.findMany({ where: { projectId } });
  const directCostTotal = costs.reduce((sum, c) => sum + Number(c.lineTotal ?? 0), 0);

  const overheadPercent      = Number(b.overheadPercent      ?? 0);
  const overheadAmount       = directCostTotal * (overheadPercent / 100);
  const consultingFee        = Number(b.consultingFee        ?? 0);
  const projectManagementFee = Number(b.projectManagementFee ?? 0);
  const contingencyAmount    = Number(b.contingencyAmount    ?? 0);
  const taxAmount            = Number(b.taxAmount            ?? 0);
  const grandTotal           = directCostTotal + overheadAmount + consultingFee + projectManagementFee + contingencyAmount + taxAmount;

  const summary = await prisma.projectFeeSummary.upsert({
    where:  { projectId },
    update: { directCostTotal, overheadPercent, overheadAmount, consultingFee, projectManagementFee, contingencyAmount, taxAmount, grandTotal },
    create: { projectId, directCostTotal, overheadPercent, overheadAmount, consultingFee, projectManagementFee, contingencyAmount, taxAmount, grandTotal },
  });

  return NextResponse.json(summary);
}
