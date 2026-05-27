import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { CostEstimator } from '@/components/CostEstimator';

export default async function ProjectCostPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where:   { id: Number(projectId) },
    include: {
      customer:   { select: { customerName: true } },
      costs:      { orderBy: [{ costCategory: 'asc' }, { id: 'asc' }] },
      feeSummary: true,
    },
  });

  if (!project) notFound();

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
        initialCosts={project.costs.map(c => ({
          id:           c.id,
          costCategory: c.costCategory,
          description:  c.description  ?? '',
          quantity:     Number(c.quantity),
          unitCost:     Number(c.unitCost),
          markupPercent:Number(c.markupPercent),
          lineTotal:    Number(c.lineTotal ?? 0),
          vendor:       c.vendor   ?? '',
          billable:     c.billable,
          notes:        c.notes    ?? '',
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
