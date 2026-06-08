import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { CostEstimator } from '@/components/CostEstimator';

export const dynamic = 'force-dynamic';

export default async function ProjectCostPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where:   { id: Number(projectId) },
    include: {
      customer:   { select: { customerName: true } },
      costs:      {
        orderBy: [{ category: { sortOrder: 'asc' } }, { id: 'asc' }],
        include: { category: true },
      },
      feeSummary: true,
      site: {
        include: {
          buildings: {
            orderBy: { buildingName: 'asc' },
            include: {
              locations: {
                orderBy: [{ floor: 'asc' }, { areaName: 'asc' }],
                include: { cameraModel: true },
              },
            },
          },
        },
      },
    },
  });

  if (!project) notFound();

  // Load stored markup overrides for survey camera rows (keyed by cameraModelId)
  const surveyOverrideRows = await prisma.projectCost.findMany({
    where: { projectId: Number(projectId), surveyLocationId: { not: null } },
    select: { id: true, cameraModelId: true, surveyLocationId: true, markupPercent: true },
  });
  const surveyOverrides: Record<number, { costId: number; markupPercent: number }> = {};
  const surveyOverrideIds = new Set<number>();
  for (const row of surveyOverrideRows) {
    if (row.cameraModelId != null) {
      surveyOverrides[row.cameraModelId] = { costId: row.id, markupPercent: Number(row.markupPercent) };
      surveyOverrideIds.add(row.id);
    }
  }

  // Flatten all locations with a valid catalog price, then group by camera model
  type SurveyGroup = {
    locationId: number; cameraModelId: number; description: string;
    quantity: number; unitCost: number; lineTotal: number;
  };
  const groupMap = new Map<number, SurveyGroup>();
  for (const b of project.site?.buildings ?? []) {
    for (const l of b.locations) {
      if (!l.cameraModelId || !l.cameraModel?.cost) continue;
      const unitCost = Number(l.cameraModel.cost);
      if (unitCost <= 0) continue;
      const description = [l.cameraModel.manufacturer, l.cameraModel.model].filter(Boolean).join(' ') || 'Unspecified Camera';
      if (groupMap.has(l.cameraModelId)) {
        const g = groupMap.get(l.cameraModelId)!;
        g.quantity += 1;
        g.lineTotal = g.unitCost * g.quantity;
      } else {
        groupMap.set(l.cameraModelId, {
          locationId:    l.id,
          cameraModelId: l.cameraModelId,
          description,
          quantity:      1,
          unitCost,
          lineTotal:     unitCost,
        });
      }
    }
  }
  const surveyItems = Array.from(groupMap.values());

  return (
    <div>
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/costs" className="hover:text-gray-700">Cost Estimator</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">{project.projectName}</span>
      </nav>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{project.projectName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {project.customer.customerName}
            {project.projectNumber && <span className="ml-2">{project.projectNumber}</span>}
          </p>
        </div>
        <Link href={`/projects/${project.id}`} className="btn-secondary text-xs">
          View Project →
        </Link>
      </div>

      <CostEstimator
        projectId={project.id}
        overheadRateDefault={project.overheadRatePercent ? Number(project.overheadRatePercent) : 15}
        surveyItems={surveyItems}
        surveyOverrides={surveyOverrides}
        initialCosts={project.costs.filter(c => !surveyOverrideIds.has(c.id)).map(c => ({
          id:            c.id,
          categoryId:    c.categoryId,
          categoryName:  c.category.name,
          cameraModelId: c.cameraModelId ?? 0,
          description:   c.description  ?? '',
          quantity:      Number(c.quantity),
          unitCost:      Number(c.unitCost),
          markupPercent: Number(c.markupPercent),
          lineTotal:     Number(c.lineTotal ?? 0),
          vendor:        c.vendor   ?? '',
          url:           (c as Record<string, unknown>).url as string ?? '',
          billable:      c.billable,
          notes:         c.notes    ?? '',
        }))}
        initialSummary={project.feeSummary ? {
          overheadPercent:      Number(project.feeSummary.overheadPercent),
          overheadAmount:       Number(project.feeSummary.overheadAmount),
          consultingFee:        Number(project.feeSummary.consultingFee),
          projectManagementFee: Number(project.feeSummary.projectManagementFee),
          contingencyAmount:    Number(project.feeSummary.contingencyAmount),
          taxAmount:            Number(project.feeSummary.taxAmount),
          grandTotal:           Number(project.feeSummary.grandTotal),
        } : null}
      />
    </div>
  );
}
