import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { PlusIcon, FolderIcon } from '@heroicons/react/24/outline';
import { ProjectStatus } from '@prisma/client';

const statusColors: Record<string, string> = {
  PROPOSED:    'bg-gray-100 text-gray-600',
  APPROVED:    'bg-blue-50 text-blue-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-700',
  COMPLETED:   'bg-green-50 text-green-700',
  ON_HOLD:     'bg-orange-50 text-orange-700',
  CANCELLED:   'bg-red-50 text-red-600',
};

const statusLabels: Record<string, string> = {
  PROPOSED:    'Proposed',
  APPROVED:    'Approved',
  IN_PROGRESS: 'In Progress',
  COMPLETED:   'Completed',
  ON_HOLD:     'On Hold',
  CANCELLED:   'Cancelled',
};

const statusFilterOptions = [
  { value: '',            label: 'All Statuses'  },
  { value: 'PROPOSED',    label: 'Proposed'      },
  { value: 'APPROVED',    label: 'Approved'      },
  { value: 'IN_PROGRESS', label: 'In Progress'   },
  { value: 'COMPLETED',   label: 'Completed'     },
  { value: 'ON_HOLD',     label: 'On Hold'       },
  { value: 'CANCELLED',   label: 'Cancelled'     },
];

interface BuildingRow {
  projectId:    number;
  buildingId:   number;
  buildingName: string;
  siteId:       number;
  siteName:     string;
}

async function getProjects(search: string, status: string) {
  const projects = await prisma.project.findMany({
    where: {
      ...(status ? { projectStatus: status as ProjectStatus } : {}),
      ...(search
        ? {
            OR: [
              { projectName:    { contains: search } },
              { projectNumber:  { contains: search } },
              { projectManager: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      customer: { select: { id: true, customerName: true } },
    },
    orderBy: { projectName: 'asc' },
  });

  const projectIds = projects.map(p => p.id);

  const buildingRows = projectIds.length > 0
    ? await prisma.$queryRaw<BuildingRow[]>(
        Prisma.sql`
          SELECT p.project_id AS projectId,
                 b.building_id AS buildingId,
                 b.building_name AS buildingName,
                 s.site_id AS siteId,
                 s.site_name AS siteName
          FROM projects p
          JOIN buildings b ON b.building_id = p.building_id
          JOIN sites s     ON s.site_id = b.site_id
          WHERE p.project_id IN (${Prisma.join(projectIds)})`
      ).catch(() => [] as BuildingRow[])
    : [];

  const buildingByProject = new Map(
    buildingRows.map(r => [r.projectId, { id: r.buildingId, buildingName: r.buildingName, siteId: r.siteId, siteName: r.siteName }])
  );

  return projects.map(p => ({ ...p, building: buildingByProject.get(p.id) ?? null }));
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { search?: string; status?: string };
}) {
  const search   = searchParams.search ?? '';
  const status   = searchParams.status ?? '';
  const projects = await getProjects(search, status);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">{projects.length} total</p>
        </div>
        <Link href="/projects/new" className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          New Project
        </Link>
      </div>

      {/* Filters */}
      <form className="flex gap-3 mb-4 flex-wrap">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search projects…"
          className="form-input w-56"
        />
        <select name="status" defaultValue={status} className="form-select w-44">
          {statusFilterOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">Filter</button>
        {(search || status) && (
          <Link href="/projects" className="btn-secondary">Clear</Link>
        )}
      </form>

      {/* Table */}
      {projects.length === 0 ? (
        <div className="card p-12 text-center">
          <FolderIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {search || status ? 'No projects match your filters.' : 'No projects yet.'}
          </p>
          {!search && !status && (
            <Link href="/projects/new" className="btn-primary mt-4 inline-flex">
              <PlusIcon className="w-4 h-4" /> Create your first project
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Project</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Manager</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Dates</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Building</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projects.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${p.id}`}
                      className="font-medium text-blue-600 hover:underline block"
                    >
                      {p.projectName}
                    </Link>
                    {p.projectNumber && (
                      <span className="text-xs text-gray-400">{p.projectNumber}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <Link href={`/customers/${p.customer.id}`} className="hover:underline">
                      {p.customer.customerName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.projectManager ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {p.startDate
                      ? new Date(p.startDate).toLocaleDateString()
                      : '—'}
                    {p.completionDate && (
                      <> → {new Date(p.completionDate).toLocaleDateString()}</>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`badge ${statusColors[p.projectStatus]}`}>
                      {statusLabels[p.projectStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.building ? (
                      <div>
                        <span className="font-medium text-gray-800">{p.building.buildingName}</span>
                        <p className="text-xs text-gray-400">{p.building.siteName}</p>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
