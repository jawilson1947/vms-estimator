import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  PlusIcon, FolderIcon, MagnifyingGlassIcon,
  ChevronLeftIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { ProjectStatus } from '@prisma/client';
import { ProjectLocationsList } from '@/components/ProjectLocationsList';

const PAGE_SIZE = 8;

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

async function getProjects(search: string, status: string, page: number) {
  const where = {
    ...(status ? { projectStatus: status as ProjectStatus } : {}),
    ...(search
      ? {
          OR: [
            { projectName:    { contains: search } },
            { projectNumber:  { contains: search } },
            { projectManager: { contains: search } },
            { customer: { customerName: { contains: search } } },
            { building: { buildingName: { contains: search } } },
            { building: { site: { siteName: { contains: search } } } },
          ],
        }
      : {}),
  };

  const total = await prisma.project.count({ where });
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const projects = await prisma.project.findMany({
    where,
    include: {
      customer: { select: { id: true, customerName: true } },
      cameraLocations: {
        select:  { id: true, areaName: true, floor: true },
        orderBy: [{ floor: 'asc' }, { areaName: 'asc' }],
      },
    },
    orderBy: { projectName: 'asc' },
    skip:    (currentPage - 1) * PAGE_SIZE,
    take:    PAGE_SIZE,
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

  return {
    projects: projects.map(p => ({ ...p, building: buildingByProject.get(p.id) ?? null })),
    total,
    totalPages,
    currentPage,
  };
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = params.search ?? '';
  const status = params.status ?? '';
  const { projects, total, totalPages, currentPage } = await getProjects(search, status, Number(params.page) || 1);

  const pageHref = (p: number) =>
    `/projects?${new URLSearchParams({
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      ...(p > 1 ? { page: String(p) } : {}),
    })}`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total</p>
        </div>
        <Link href="/projects/new" className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          New Project
        </Link>
      </div>

      {/* Filters */}
      <form className="flex gap-3 mb-4 flex-wrap">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            name="search"
            defaultValue={search}
            placeholder="Search project, customer, building…"
            className="form-input pl-9 w-72"
          />
        </div>
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
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Survey Locations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projects.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors align-top">
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
                  <td className="px-4 py-3">
                    <ProjectLocationsList locations={p.cameraLocations} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 text-xs text-gray-500">
              <span>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                {currentPage > 1 ? (
                  <Link href={pageHref(currentPage - 1)} title="Previous page"
                    className="p-1 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100">
                    <ChevronLeftIcon className="w-4 h-4" />
                  </Link>
                ) : (
                  <span className="p-1 opacity-30"><ChevronLeftIcon className="w-4 h-4" /></span>
                )}
                <span className="tabular-nums">Page {currentPage} of {totalPages}</span>
                {currentPage < totalPages ? (
                  <Link href={pageHref(currentPage + 1)} title="Next page"
                    className="p-1 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100">
                    <ChevronRightIcon className="w-4 h-4" />
                  </Link>
                ) : (
                  <span className="p-1 opacity-30"><ChevronRightIcon className="w-4 h-4" /></span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
