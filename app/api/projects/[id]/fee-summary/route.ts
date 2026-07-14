import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildCostSchedule } from '@/lib/cost-schedule';

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/[id]/fee-summary
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const summary = await prisma.projectFeeSummary.findUnique({
    where: { projectId: Number(id) },
  });

  return NextResponse.json(summary ?? null);
}

// PUT /api/projects/[id]/fee-summary — upsert
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectId = Number(id);
  const b = await req.json();

  // Fetch both manual costs and camera locations to compute the live direct total
  const [costs, cameraLocations] = await Promise.all([
    prisma.projectCost.findMany({
      where:   { projectId },
      include: { category: true },
    }),
    prisma.cameraLocation.findMany({
      where:   { projectId },
      select:  {
        id: true, cameraModelId: true,
        cameraModel: { select: { manufacturer: true, model: true, cost: true } },
      },
    }),
  ]);

  const overheadPercent = Number(b.overheadPercent ?? 0);

  // Build a minimal feeSummary stub so buildCostSchedule picks up the overhead rate
  const feeSummaryStub = {
    overheadPercent,
    consultingFee:        Number(b.consultingFee        ?? 0),
    projectManagementFee: Number(b.projectManagementFee ?? 0),
    contingencyAmount:    Number(b.contingencyAmount    ?? 0),
    taxAmount:            Number(b.taxAmount            ?? 0),
    downPayment:          Number(b.downPayment          ?? 0),
  };

  const schedule = buildCostSchedule(
    cameraLocations as Parameters<typeof buildCostSchedule>[0],
    costs           as unknown as Parameters<typeof buildCostSchedule>[1],
    feeSummaryStub  as Parameters<typeof buildCostSchedule>[2],
  );

  const directCostTotal      = schedule.directTotal;
  const overheadAmount       = schedule.overheadAmount;
  const consultingFee        = schedule.consultingFee;
  const projectManagementFee = schedule.projectManagementFee;
  const contingencyAmount    = schedule.contingencyAmount;
  const taxAmount            = schedule.taxAmount;
  const downPayment          = schedule.downPayment;
  const grandTotal           = schedule.grandTotal;

  const summary = await prisma.projectFeeSummary.upsert({
    where:  { projectId },
    update: { directCostTotal, overheadPercent, overheadAmount, consultingFee, projectManagementFee, contingencyAmount, taxAmount, downPayment, grandTotal },
    create: { projectId, directCostTotal, overheadPercent, overheadAmount, consultingFee, projectManagementFee, contingencyAmount, taxAmount, downPayment, grandTotal },
  });

  return NextResponse.json(summary);
}
