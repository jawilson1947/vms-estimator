import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  PlusIcon, MapPinIcon, MagnifyingGlassIcon,
  ChevronLeftIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { SiteBuildingsList, type BuildingEntry } from '@/components/SiteBuildingsList';

const PAGE_SIZE = 8;

interface ProjectLink { id: number; projectName: string }
interface SiteProjectRow { siteId: number; id: number; projectName: string }

function siteWhere(search: string) {
  return search
    ? {
        OR: [
          { siteName: { contains: search } },
          { city:     { contains: search } },
          { state:    { contains: search } },
          { customer:  { customerName: { contains: search } } },
          { buildings: { some: { buildingName: { contains: search } } } },
        ],
      }
    : undefined;
}

async function getSites(search: string, page: number) {
  const where = siteWhere(search);
  const total = await prisma.site.count({ where });
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const sites = await prisma.site.findMany({
    where,
    include: {
      customer:  { select: { id: true, customerName: true } },
      buildings: {
        select: {
          id:           true,
          buildingName: true,
          projects: {
            select: {
              cameraLocations: {
                select:  { id: true, areaName: true, floor: true },
                orderBy: [{ floor: 'asc' }, { areaName: 'asc' }],
              },
            },
          },
        },
        orderBy: { buildingName: 'asc' },
      },
    },
    orderBy: { siteName: 'asc' },
    skip:    (currentPage - 1) * PAGE_SIZE,
    take:    PAGE_SIZE,
  });

  const siteIds = sites.map(s => s.id);
  const projectRows = siteIds.length > 0
    ? await prisma.$queryRaw<SiteProjectRow[]>(
        Prisma.sql`SELECT b.site_id AS siteId, p.project_id AS id, p.project_name AS projectName
                   FROM projects p
                   JOIN buildings b ON b.building_id = p.building_id
                   WHERE b.site_id IN (${Prisma.join(siteIds)})`
      ).catch(() => [] as SiteProjectRow[])
    : [];

  const projectsBySite = new Map<number, ProjectLink[]>();
  for (const row of projectRows) {
    const list = projectsBySite.get(row.siteId) ?? [];
    list.push({ id: row.id, projectName: row.projectName });
    projectsBySite.set(row.siteId, list);
  }

  return {
    sites: sites.map(s => ({
      ...s,
      projects: projectsBySite.get(s.id) ?? [],
      // Roll each building's survey locations (via its projects) into one flat list
      buildingEntries: s.buildings.map((b): BuildingEntry => ({
        id:           b.id,
        buildingName: b.buildingName,
        locations:    b.projects.flatMap(p => p.cameraLocations),
      })),
    })),
    total,
    totalPages,
    currentPage,
  };
}

export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = params.search ?? '';
  const { sites, total, totalPages, currentPage } = await getSites(search, Number(params.page) || 1);

  const pageHref = (p: number) =>
    `/sites?${new URLSearchParams({ ...(search ? { search } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sites</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total</p>
        </div>
        <Link href="/sites/new" className="btn-primary">
          <PlusIcon className="w-4 h-4" /> Add Site
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <form>
          <input
            name="search" defaultValue={search}
            placeholder="Search site, city, customer, building…"
            className="form-input pl-9 w-full"
          />
        </form>
      </div>

      {sites.length === 0 ? (
        <div className="card p-12 text-center">
          <MapPinIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {search ? 'No sites match your search.' : 'No sites yet.'}
          </p>
          {!search && (
            <Link href="/sites/new" className="btn-primary mt-4 inline-flex">
              <PlusIcon className="w-4 h-4" /> Add first site
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Site</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Location</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Projects</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Buildings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sites.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors align-top">
                  <td className="px-4 py-3">
                    <Link href={`/sites/${s.id}`} className="font-medium text-blue-600 hover:underline">
                      {s.siteName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {[s.city, s.state].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.customer
                      ? <Link href={`/customers/${s.customer.id}`} className="hover:underline">{s.customer.customerName}</Link>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.projects.length === 0 ? '—' : s.projects.map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && ', '}
                        <Link href={`/projects/${p.id}`} className="hover:underline">{p.projectName}</Link>
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-3">
                    <SiteBuildingsList buildings={s.buildingEntries} />
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
