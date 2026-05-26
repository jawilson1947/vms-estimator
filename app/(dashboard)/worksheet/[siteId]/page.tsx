import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  ChevronRightIcon, DocumentTextIcon, CameraIcon,
  ServerStackIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline';

type Params = { params: { siteId: string } };

// Derive exact return type from the query so TypeScript sees all relations
const siteWithDetails = Prisma.validator<Prisma.SiteDefaultArgs>()({
  include: {
    customer: true,
    project:  { select: { id: true, projectName: true, projectNumber: true } },
    buildings: {
      include: {
        locations: {
          include: {
            cameras: {
              where: { status: { not: 'RETIRED' } },
              include: { model: true },
            },
          },
          orderBy: { areaName: 'asc' as const },
        },
      },
      orderBy: { buildingName: 'asc' as const },
    },
  },
});

type SiteWithDetails = Prisma.SiteGetPayload<typeof siteWithDetails>;
type CamRow = SiteWithDetails['buildings'][number]['locations'][number]['cameras'][number];

// Storage calculation helper
// bitrateMbps * 3600s * retentionDays / 8 bits-per-byte / 1024² → GB
function storageGB(cam: CamRow): number {
  const mbps = cam.bitrateMbps ? Number(cam.bitrateMbps) : null;
  const days  = cam.retentionDays;
  if (!mbps || !days) return 0;
  return (mbps * 3600 * days) / 8 / 1024;
}

function fmt2(n: number) { return n.toFixed(2); }

export default async function WorksheetPage({ params }: Params) {
  const site = await prisma.site.findUnique({
    where: { id: Number(params.siteId) },
    ...siteWithDetails,
  });

  if (!site) notFound();

  const allCameras = site.buildings.flatMap(b => b.locations.flatMap(l => l.cameras));
  const totalCameras   = allCameras.length;
  const totalStorageGB = allCameras.reduce((s, c) => s + storageGB(c), 0);
  const totalPoeWatts  = allCameras.reduce(
    (s, c) => s + (c.model?.maxPowerWatts ? Number(c.model.maxPowerWatts) : 0), 0
  );
  const complianceIssues = allCameras.filter(c => !c.usernameChanged || !c.httpsEnabled).length;

  const statusCounts = allCameras.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

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
            {site.project && (
              <Link href={`/projects/${site.project.id}`} className="ml-2 text-blue-600 hover:underline">
                {site.project.projectName}
                {site.project.projectNumber && ` (${site.project.projectNumber})`}
              </Link>
            )}
          </p>
          {(site.address || site.city) && (
            <p className="text-sm text-gray-400 mt-0.5">
              {[site.address, site.city, site.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{totalCameras}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Cameras</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-indigo-700">{fmt2(totalStorageGB / 1024)} TB</p>
          <p className="text-xs text-gray-500 mt-0.5">Storage Required</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-purple-700">{totalPoeWatts}W</p>
          <p className="text-xs text-gray-500 mt-0.5">Total PoE Draw</p>
        </div>
        <div className="card p-4 text-center">
          <p className={`text-2xl font-bold ${complianceIssues > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {complianceIssues}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Compliance Issues</p>
        </div>
      </div>

      {/* Status breakdown */}
      {Object.keys(statusCounts).length > 0 && (
        <div className="card p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <CameraIcon className="w-4 h-4 text-blue-500" />
            Camera Status Summary
          </h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-gray-900">{count}</span>
                <span className="text-gray-500">{status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-building breakdown */}
      {site.buildings.map(building => {
        const bCameras = building.locations.flatMap(l => l.cameras);
        const bStorageGB = bCameras.reduce((s, c) => s + storageGB(c), 0);
        const bPoeWatts  = bCameras.reduce(
          (s, c) => s + (c.model?.maxPowerWatts ? Number(c.model.maxPowerWatts) : 0), 0
        );

        return (
          <div key={building.id} className="card overflow-hidden mb-4">
            {/* Building header */}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">{building.buildingName}</h2>
              <div className="flex gap-5 text-sm text-gray-500">
                <span>{bCameras.length} cameras</span>
                {bStorageGB > 0 && <span>{fmt2(bStorageGB / 1024)} TB storage</span>}
                {bPoeWatts > 0  && <span>{bPoeWatts}W PoE</span>}
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-2 text-xs font-semibold text-gray-500">Location</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Camera</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Model</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Type</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Resolution</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">FoV</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Storage</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">PoE</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500">Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {building.locations.map(loc => {
                  const locLabel = loc.areaName ?? loc.mountingLocation ?? `Location ${loc.id}`;

                  if (loc.cameras.length === 0) {
                    return (
                      <tr key={loc.id} className="text-gray-400">
                        <td className="px-5 py-2.5">
                          <span className="text-xs">{locLabel}</span>
                          {loc.floor && <span className="ml-1 text-xs">(Floor {loc.floor})</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs italic" colSpan={8}>No camera assigned</td>
                      </tr>
                    );
                  }

                  return loc.cameras.map((cam, ci) => {
                    const gb  = storageGB(cam);
                    const poe = cam.model?.maxPowerWatts ? Number(cam.model.maxPowerWatts) : null;
                    const ok  = cam.usernameChanged && cam.httpsEnabled;

                    return (
                      <tr key={cam.id} className="hover:bg-gray-50">
                        {ci === 0 && (
                          <td rowSpan={loc.cameras.length} className="px-5 py-2.5 align-top border-r border-gray-50">
                            <p className="text-xs text-gray-700">{locLabel}</p>
                            {loc.coveragePurpose && (
                              <p className="text-xs text-gray-400 mt-0.5">{loc.coveragePurpose}</p>
                            )}
                            {loc.floor && (
                              <p className="text-xs text-gray-400">Floor {loc.floor}</p>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-2.5">
                          <Link href={`/cameras/${cam.id}`} className="text-blue-600 hover:underline font-medium">
                            {cam.cameraCode}
                          </Link>
                          <p className="text-xs text-gray-400">{cam.cameraName}</p>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {cam.model
                            ? `${cam.model.manufacturer ?? ''} ${cam.model.modelNumber ?? ''}`.trim() || '—'
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{cam.model?.cameraType ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{cam.model?.resolution ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{cam.model?.fieldOfView ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">
                          {gb > 0 ? `${fmt2(gb)} GB` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600">
                          {poe ? `${poe}W` : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`badge ${ok ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                            {ok ? '✓ OK' : '⚠ Issues'}
                          </span>
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>

              {bCameras.length > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50 font-semibold text-sm">
                    <td className="px-5 py-2 text-gray-700" colSpan={6}>Subtotal — {building.buildingName}</td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {bStorageGB > 0 ? `${fmt2(bStorageGB)} GB` : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {bPoeWatts > 0 ? `${bPoeWatts}W` : '—'}
                    </td>
                    <td className="px-4 py-2"></td>
                  </tr>
                </tfoot>
              )}
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
            <p className="text-xs text-gray-400 mb-0.5">Total Cameras</p>
            <p className="text-lg font-bold text-gray-900">{totalCameras}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Storage Required</p>
            <p className="text-lg font-bold text-indigo-700">
              {totalStorageGB >= 1024
                ? `${fmt2(totalStorageGB / 1024)} TB`
                : `${fmt2(totalStorageGB)} GB`}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Total PoE Draw</p>
            <p className="text-lg font-bold text-purple-700">{totalPoeWatts}W</p>
          </div>
        </div>

        {/* Compliance breakdown */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheckIcon className="w-4 h-4 text-green-500" />
            <span className="text-sm font-semibold text-gray-700">Security Compliance</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {[
              { label: 'Username Changed', field: 'usernameChanged' as const },
              { label: 'HTTPS Enabled',    field: 'httpsEnabled'    as const },
              { label: 'Privacy Mask',     field: 'privacyMaskEnabled' as const },
            ].map(({ label, field }) => {
              const passing = allCameras.filter(c => c[field]).length;
              const total   = allCameras.length;
              const pct     = total > 0 ? Math.round((passing / total) * 100) : 0;
              return (
                <div key={field} className="card p-3 text-center">
                  <p className={`text-lg font-bold ${pct === 100 ? 'text-green-600' : 'text-amber-600'}`}>
                    {passing}/{total}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-amber-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
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
