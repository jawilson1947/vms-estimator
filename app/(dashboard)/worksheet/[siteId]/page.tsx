import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  ChevronRightIcon, DocumentTextIcon, CameraIcon, ServerStackIcon,
} from '@heroicons/react/24/outline';

type Params = { params: { siteId: string } };

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default async function WorksheetPage({ params }: Params) {
  const site = await prisma.site.findUnique({
    where: { id: Number(params.siteId) },
    include: {
      customer: true,
      projects: { select: { id: true, projectName: true, projectNumber: true } },
      buildings: {
        include: {
          locations: {
            include: {
              cameraModel: {
                select: {
                  id: true, manufacturer: true, model: true, cameraType: true,
                  resolution: true, megapixels: true, cost: true, indoorOutdoor: true, ptz: true,
                },
              },
            },
            orderBy: { areaName: 'asc' },
          },
        },
        orderBy: { buildingName: 'asc' },
      },
    },
  });

  if (!site) notFound();

  const allLocations = site.buildings.flatMap(b => b.locations);
  const assigned     = allLocations.filter(l => l.cameraModel != null);
  const totalCost    = assigned.reduce((s, l) => s + (l.cameraModel?.cost ? Number(l.cameraModel.cost) : 0), 0);

  return (
    <div className="max-w-5xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/worksheet" className="hover:text-gray-700">Worksheet</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">{site.siteName}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{site.siteName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {site.customer?.customerName}
            {site.projects.map(p => (
              <Link key={p.id} href={`/projects/${p.id}`} className="ml-2 text-blue-600 hover:underline">
                {p.projectName}
                {p.projectNumber && ` (${p.projectNumber})`}
              </Link>
            ))}
          </p>
          {(site.address || site.city) && (
            <p className="text-sm text-gray-400 mt-0.5">
              {[site.address, site.city, site.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{allLocations.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Locations</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{assigned.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Cameras Assigned</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{allLocations.length - assigned.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Unassigned</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-violet-700">
            {totalCost > 0 ? fmt(totalCost) : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Equipment Cost</p>
        </div>
      </div>

      {/* Per-building breakdown */}
      {site.buildings.map(building => {
        const bLocs     = building.locations;
        const bAssigned = bLocs.filter(l => l.cameraModel != null);
        const bCost     = bAssigned.reduce((s, l) => s + (l.cameraModel?.cost ? Number(l.cameraModel.cost) : 0), 0);

        return (
          <div key={building.id} className="card overflow-hidden mb-4">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">{building.buildingName}</h2>
              <div className="flex gap-5 text-sm text-gray-500">
                <span>{bAssigned.length}/{bLocs.length} assigned</span>
                {bCost > 0 && <span>{fmt(bCost)}</span>}
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-2 text-xs font-semibold text-gray-500">Location</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Manufacturer</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Model</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Type</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Resolution</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bLocs.map(loc => {
                  const locLabel = loc.areaName ?? loc.mountingLocation ?? `Location ${loc.id}`;
                  const cm       = loc.cameraModel;
                  return (
                    <tr key={loc.id} className={cm ? 'hover:bg-gray-50' : 'text-gray-400'}>
                      <td className="px-5 py-2.5">
                        <span className="text-xs text-gray-700">{locLabel}</span>
                        {loc.floor && <span className="ml-1 text-xs text-gray-400">(Floor {loc.floor})</span>}
                      </td>
                      {cm ? (
                        <>
                          <td className="px-4 py-2.5 text-gray-600 text-xs">{cm.manufacturer ?? '—'}</td>
                          <td className="px-4 py-2.5 text-gray-600 text-xs">{cm.model ?? '—'}</td>
                          <td className="px-4 py-2.5 text-gray-600 text-xs">{cm.cameraType ?? '—'}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600 text-xs font-mono">{cm.resolution ?? '—'}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600 text-xs">
                            {cm.cost != null ? fmt(Number(cm.cost)) : '—'}
                          </td>
                        </>
                      ) : (
                        <td className="px-4 py-2.5 text-xs italic" colSpan={5}>No camera assigned</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Site totals */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <ServerStackIcon className="w-4 h-4 text-violet-500" />
          Site Totals — {site.siteName}
        </h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Total Locations</p>
            <p className="text-lg font-bold text-gray-900">{allLocations.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Assigned</p>
            <p className="text-lg font-bold text-green-700">{assigned.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Equipment Cost</p>
            <p className="text-lg font-bold text-violet-700">
              {totalCost > 0 ? fmt(totalCost) : '—'}
            </p>
          </div>
        </div>
      </div>

      {site.notes && (
        <div className="card p-5 mt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Site Notes</h3>
          <p className="text-sm text-gray-600">{site.notes}</p>
        </div>
      )}
    </div>
  );
}
