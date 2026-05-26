import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  ChevronRightIcon, PencilSquareIcon, PlusIcon,
  MapPinIcon, CurrencyDollarIcon, BuildingOffice2Icon,
} from '@heroicons/react/24/outline';

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

const costCategoryLabels: Record<string, string> = {
  CAMERA_EQUIPMENT:   'Camera Equipment',  NETWORK_EQUIPMENT: 'Network Equipment',
  CABLING:            'Cabling',           MOUNTING_HARDWARE: 'Mounting Hardware',
  LICENSING:          'Licensing',         LABOR:             'Labor',
  CONSULTING:         'Consulting',        PROJECT_MANAGEMENT:'Project Management',
  OVERHEAD:           'Overhead',          TRAVEL:            'Travel',
  PERMITS:            'Permits',           CONTINGENCY:       'Contingency',
  OTHER:              'Other',
};

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where:   { id: Number(params.id) },
    include: {
      customer:   { select: { id: true, customerName: true } },
      sites:      { orderBy: { siteName: 'asc' }, include: { buildings: true } },
      costs:      { orderBy: { costCategory: 'asc' } },
      feeSummary: true,
    },
  });

  if (!project) notFound();

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
        <Link href={`/projects/${project.id}/edit`} className="btn-secondary">
          <PencilSquareIcon className="w-4 h-4" /> Edit
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {/* Project info */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Project Details</h2>
          <dl className="space-y-2 text-sm">
            {[
              ['Start Date',       project.startDate      ? new Date(project.startDate).toLocaleDateString()      : '—'],
              ['Completion Date',  project.completionDate ? new Date(project.completionDate).toLocaleDateString()  : '—'],
              ['Consulting Rate',  project.consultingRate      ? `$${Number(project.consultingRate).toFixed(2)}/hr`      : '—'],
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
                  <dd className="text-gray-900">${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}</dd>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-gray-200 font-semibold">
                <dt>Grand Total</dt>
                <dd className="text-blue-700">
                  ${Number(project.feeSummary.grandTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="text-center py-4">
              <CurrencyDollarIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No cost summary yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                Total from line items: <strong>${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sites */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Sites
            <span className="ml-2 badge bg-gray-100 text-gray-600">{project.sites.length}</span>
          </h2>
          <Link href={`/sites/new?projectId=${project.id}`} className="btn-secondary text-xs py-1 px-2.5">
            <PlusIcon className="w-3.5 h-3.5" /> Add Site
          </Link>
        </div>

        {project.sites.length === 0 ? (
          <p className="text-sm text-gray-400">No sites added yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {project.sites.map(s => (
              <Link
                key={s.id}
                href={`/sites/${s.id}`}
                className="flex items-start gap-2 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-sm"
              >
                <MapPinIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">{s.siteName}</p>
                  {(s.city || s.state) && (
                    <p className="text-xs text-gray-500">{[s.city, s.state].filter(Boolean).join(', ')}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.buildings.length} building{s.buildings.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Cost line items */}
      {project.costs.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Cost Line Items</h2>
            <Link href={`/costs?projectId=${project.id}`} className="btn-secondary text-xs py-1 px-2.5">
              <PlusIcon className="w-3.5 h-3.5" /> Add Cost
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Description</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Qty</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Unit Cost</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Markup</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {project.costs.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <span className="badge bg-gray-100 text-gray-600 text-xs">
                      {costCategoryLabels[c.costCategory]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{c.description ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{Number(c.quantity)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">
                    ${Number(c.unitCost).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{Number(c.markupPercent)}%</td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                    ${Number(c.lineTotal ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">
                  Total
                </td>
                <td className="px-4 py-3 text-right font-bold text-blue-700">
                  ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
           
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
