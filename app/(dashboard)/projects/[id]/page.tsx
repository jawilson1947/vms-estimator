import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  ChevronRightIcon, PencilSquareIcon,
  BuildingOfficeIcon, CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { ProjectProposalButton } from '@/components/ProjectProposalButton';
import { ProposalHistory } from '@/components/ProposalHistory';
import { ProjectScopePanel } from '@/components/ProjectScopePanel';
import { AddBuildingButton } from '@/components/AddBuildingButton';
import { RemoveBuildingButton } from '@/components/RemoveBuildingButton';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

const statusColors: Record<string, string> = {
  PROPOSED:    'bg-gray-100 text-gray-600',
  APPROVED:    'bg-blue-50 text-blue-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-700',
  COMPLETED:   'bg-green-50 text-green-700',
  ON_HOLD:     'bg-orange-50 text-orange-700',
  CANCELLED:   'bg-red-50 text-red-600',
};

const statusLabels: Record<string, string> = {
  PROPOSED: 'Proposed', APPROVED: 'Approved', IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed', ON_HOLD: 'On Hold', CANCELLED: 'Cancelled',
};

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = Number(id);

  const project = await prisma.project.findUnique({
    where:   { id: projectId },
    include: {
      customer:   { select: { id: true, customerName: true } },
      building: {
        include: {
          site: { select: { id: true, siteName: true, city: true, state: true } },
        },
      },
      cameraLocations: {
        orderBy: [{ areaName: 'asc' }],
        include: {
          cameraModel: {
            select: { id: true, manufacturer: true, model: true, cost: true, cameraType: true },
          },
        },
      },
      costs:      { orderBy: { category: { sortOrder: 'asc' } }, include: { category: true } },
      feeSummary: true,
    },
  });

  if (!project) notFound();

  const assignedBuilding = project.building ?? null;

  // For ProjectScopePanel — attach project's cameraLocations to building for display
  const scopeSite = assignedBuilding
    ? {
        id:        assignedBuilding.site.id,
        siteName:  assignedBuilding.site.siteName,
        city:      assignedBuilding.site.city,
        state:     assignedBuilding.site.state,
        buildings: [{
          ...assignedBuilding,
          locations: project.cameraLocations,
        }],
      }
    : null;

  const totalCost = project.feeSummary
    ? Number(project.feeSummary.grandTotal)
    : project.costs.reduce((sum, c) => sum + Number(c.lineTotal ?? 0), 0);

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/projects" className="hover:text-gray-700">Projects</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">{project.projectName}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{project.projectName}</h1>
            <span className={`badge ${statusColors[project.projectStatus]}`}>
              {statusLabels[project.projectStatus]}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            {project.projectNumber && <span>{project.projectNumber}</span>}
            <Link href={`/customers/${project.customer.id}`} className="hover:underline">
              {project.customer.customerName}
            </Link>
            {project.projectManager && <span>PM: {project.projectManager}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ProjectProposalButton projectId={project.id} projectName={project.projectName} />
          <Link href={`/projects/${project.id}/edit`} className="btn-secondary">
            <PencilSquareIcon className="w-4 h-4" /> Edit
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {/* Project info */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Project Details</h2>
          <dl className="space-y-2 text-sm">
            {[
              ['Start Date',       project.startDate      ? new Date(project.startDate).toLocaleDateString()      : '—'],
              ['Completion Date',  project.completionDate ? new Date(project.completionDate).toLocaleDateString()  : '—'],
              ['Consulting Rate',  project.consultingRate      ? `${fmt(Number(project.consultingRate))}/hr`            : '—'],
              ['Overhead Rate',    project.overheadRatePercent ? `${Number(project.overheadRatePercent).toFixed(1)}%`   : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <dt className="text-gray-500">{label}</dt>
                <dd className="font-medium text-gray-900">{value}</dd>
              </div>
            ))}
          </dl>
          {project.notes && (
            <p className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600">{project.notes}</p>
          )}
        </div>

        {/* Fee summary */}
        <div className="card p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Cost Summary</h2>
            <Link href={`/costs?projectId=${project.id}`} className="text-xs text-blue-600 hover:underline">
              Manage costs →
            </Link>
          </div>

          {project.feeSummary ? (
            <dl className="space-y-1.5 text-sm">
              {(
                [
                  ['Direct Costs',       project.feeSummary.directCostTotal],
                  ['Overhead',           project.feeSummary.overheadAmount],
                  ['Consulting Fee',     project.feeSummary.consultingFee],
                  ['Project Mgmt Fee',   project.feeSummary.projectManagementFee],
                  ['Contingency',        project.feeSummary.contingencyAmount],
                  ['Tax',                project.feeSummary.taxAmount],
                ] as [string, unknown][]
              ).map(([label, val]) => (
                <div key={String(label)} className="flex justify-between">
                  <dt className="text-gray-500">{label}</dt>
                  <dd className="text-gray-900">{fmt(Number(val))}</dd>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-gray-200 font-semibold">
                <dt>Grand Total</dt>
                <dd className="text-blue-700">
                  {fmt(Number(project.feeSummary.grandTotal))}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="text-center py-4">
              <CurrencyDollarIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No cost summary yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                Total from line items: <strong>{fmt(totalCost)}</strong>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Building */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Building</h2>
          <AddBuildingButton
            projectId={project.id}
            excludeIds={assignedBuilding ? [assignedBuilding.id] : []}
            siteId={assignedBuilding?.site.id}
            label={assignedBuilding ? 'Change Building' : 'Assign Building'}
          />
        </div>

        {!assignedBuilding ? (
          <p className="text-sm text-gray-400">No building assigned to this project.</p>
        ) : (
          <div className="relative flex items-start gap-2 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-sm group">
            <Link
              href={`/sites/${assignedBuilding.site.id}`}
              className="flex items-start gap-2 flex-1 min-w-0"
            >
              <BuildingOfficeIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">{assignedBuilding.buildingName}</p>
                <p className="text-xs text-gray-500">
                  {assignedBuilding.site.siteName}
                  {(assignedBuilding.site.city || assignedBuilding.site.state) && (
                    <> &middot; {[assignedBuilding.site.city, assignedBuilding.site.state].filter(Boolean).join(', ')}</>
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {project.cameraLocations.length} survey location{project.cameraLocations.length !== 1 ? 's' : ''}
                </p>
              </div>
            </Link>
            <RemoveBuildingButton
              projectId={project.id}
              buildingId={assignedBuilding.id}
              buildingName={assignedBuilding.buildingName}
            />
          </div>
        )}
      </div>

      {/* Project Scope — survey locations + cost line items */}
      <ProjectScopePanel
        projectId={project.id}
        site={scopeSite}
        manualCosts={project.costs}
      />

      {/* Proposal History */}
      <ProposalHistory projectId={project.id} projectName={project.projectName} />
    </div>
  );
}
