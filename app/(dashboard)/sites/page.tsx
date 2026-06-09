import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { PlusIcon, MapPinIcon } from '@heroicons/react/24/outline';

interface ProjectLink { id: number; projectName: string }
interface SiteProjectRow { siteId: number; id: number; projectName: string }

async function getSites(search: string) {
  const sites = await prisma.site.findMany({
    where: search
      ? { OR: [{ siteName: { contains: search } }, { city: { contains: search } }, { state: { contains: search } }] }
      : undefined,
    include: {
      customer: { select: { id: true, customerName: true } },
      _count:   { select: { buildings: true } },
    },
    orderBy: { siteName: 'asc' },
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

  return sites.map(s => ({ ...s, projects: projectsBySite.get(s.id) ?? [] }));
}

export default async function SitesPage({ searchParams }: { searchParams: { search?: string } }) {
  const search = searchParams.search ?? '';
  const sites  = await getSites(search);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sites</h1>
          <p className="text-sm text-gray-500 mt-0.5">{sites.length} total</p>
        </div>
        <Link href="/sites/new" className="btn-primary">
          <PlusIcon className="w-4 h-4" /> Add Site
        </Link>
      </div>

      <form className="mb-4">
        <input
          name="search" defaultValue={search}
          placeholder="Search sites…" className="form-input w-56"
        />
      </form>

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
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Buildings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sites.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
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
                  <td className="px-4 py-3 text-center">
                    <span className="badge bg-gray-100 text-gray-600">{s._count.buildings}</span>
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
