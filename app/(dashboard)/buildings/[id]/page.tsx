import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  ChevronRightIcon, PencilSquareIcon,
  BuildingOffice2Icon, FolderOpenIcon,
} from '@heroicons/react/24/outline';
import { BuildingFloorPlans } from '@/components/BuildingFloorPlans';

export const dynamic = 'force-dynamic';

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

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export default async function BuildingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const building = await prisma.building.findUnique({
    where:   { id: Number(id) },
    include: {
      site: { select: { id: true, siteName: true, city: true, state: true } },
      projects: {
        orderBy: { projectName: 'asc' },
        include: {
          customer:   { select: { id: true, customerName: true } },
          feeSummary: { select: { grandTotal: true } },
          _count:     { select: { cameraLocations: true } },
        },
      },
    },
  });

  if (!building) notFound();

  const { site, projects } = building;

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/sites" className="hover:text-gray-700">Sites</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <Link href={`/sites/${site.id}`} className="hover:text-gray-700">{site.siteName}</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">{building.buildingName}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{building.buildingName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {site.siteName}
            {(site.city || site.state) && (
              <> &middot; {[site.city, site.state].filter(Boolean).join(', ')}</>
            )}
          </p>
        </div>
        <Link href={`/buildings/${building.id}/edit`} className="btn-secondary">
          <PencilSquareIcon className="w-4 h-4" /> Edit
        </Link>
      </div>

      {/* Floor plans */}
      <div className="card p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Floor Plans</h2>
        <BuildingFloorPlans buildingId={building.id} />
      </div>

      {/* Projects */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Projects</h2>
          <span className="text-xs text-gray-400">{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
        </div>

        {projects.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <FolderOpenIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No projects assigned to this building yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              Assign this building to a project from the{' '}
              <Link href="/projects" className="text-blue-600 hover:underline">Projects</Link> page.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {projects.map(p => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-blue-50 transition-colors group"
              >
                <BuildingOffice2Icon className="w-5 h-5 text-gray-300 group-hover:text-blue-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                      {p.projectName}
                    </span>
                    <span className={`badge text-xs shrink-0 ${statusColors[p.projectStatus]}`}>
                      {statusLabels[p.projectStatus]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {p.customer.customerName}
                    {' · '}
                    {p._count.cameraLocations} survey location{p._count.cameraLocations !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {p.feeSummary ? (
                    <>
                      <p className="text-xs text-gray-400">Grand Total</p>
                      <p className="font-bold text-blue-700">{fmt(Number(p.feeSummary.grandTotal))}</p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400">No estimate</p>
                  )}
                </div>
                <ChevronRightIcon className="w-4 h-4 text-gray-300 group-hover:text-blue-500 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      {building.notes && (
        <div className="card p-5 mt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Notes</h3>
          <p className="text-sm text-gray-600">{building.notes}</p>
        </div>
      )}
    </div>
  );
}
