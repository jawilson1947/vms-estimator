import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { WifiIcon, ServerStackIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

// Assume a standard 24-port 802.3at PoE+ switch supplies ~250W usable PoE budget.
// Actual switch max can vary; this is a planning default.
const DEFAULT_POE_BUDGET_WATTS = 250;

function UtilBar({ pct }: { pct: number }) {
  const capped = Math.min(pct, 100);
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${capped}%` }} />
      </div>
      <span className={`text-xs font-medium tabular-nums w-9 text-right ${
        pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-green-600'
      }`}>{pct.toFixed(0)}%</span>
    </div>
  );
}

export default async function NetworkPage() {
  const sites = await prisma.site.findMany({
    include: {
      buildings: {
        include: {
          locations: {
            include: {
              cameras: {
                where: { status: { not: 'RETIRED' } },
                include: { model: { select: { maxPowerWatts: true, poeStandard: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: { siteName: 'asc' },
  });

  // Aggregate VLAN groups across all cameras
  const allCameras = await prisma.camera.findMany({
    where:   { status: { not: 'RETIRED' } },
    include: { model: { select: { maxPowerWatts: true } } },
    orderBy: { vlanId: 'asc' },
  });

  // Build VLAN summary
  type VlanRow = { vlan: string; count: number; totalWatts: number; cameras: typeof allCameras };
  const vlanMap = new Map<string, VlanRow>();
  for (const c of allCameras) {
    const vlan = c.vlanId != null ? String(c.vlanId) : 'Unassigned';
    if (!vlanMap.has(vlan)) vlanMap.set(vlan, { vlan, count: 0, totalWatts: 0, cameras: [] });
    const row = vlanMap.get(vlan)!;
    row.count++;
    row.totalWatts += c.model?.maxPowerWatts ? Number(c.model.maxPowerWatts) : 0;
    row.cameras.push(c);
  }
  const vlanRows = Array.from(vlanMap.values()).sort((a, b) => a.vlan.localeCompare(b.vlan));

  // Build switch summary
  type SwitchRow = { sw: string; count: number; totalWatts: number };
  const switchMap = new Map<string, SwitchRow>();
  for (const c of allCameras) {
    const sw = c.switchName ?? 'Unassigned';
    if (!switchMap.has(sw)) switchMap.set(sw, { sw, count: 0, totalWatts: 0 });
    const row = switchMap.get(sw)!;
    row.count++;
    row.totalWatts += c.model?.maxPowerWatts ? Number(c.model.maxPowerWatts) : 0;
  }
  const switchRows = Array.from(switchMap.values()).sort((a, b) => b.totalWatts - a.totalWatts);

  const totalCameras = allCameras.length;
  const totalWatts   = allCameras.reduce((s, c) => s + (c.model?.maxPowerWatts ? Number(c.model.maxPowerWatts) : 0), 0);
  const unknownWatts = allCameras.filter(c => !c.model?.maxPowerWatts).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Network & PoE Budget</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Power-over-Ethernet and network utilisation across all sites.
        </p>
      </div>

      {/* Portfolio summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{totalCameras}</p>
          <p className="text-xs text-gray-500 mt-0.5">Active Cameras</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-indigo-700">{totalWatts.toFixed(0)}W</p>
          <p className="text-xs text-gray-500 mt-0.5">Total PoE Draw</p>
        </div>
        <div className="card p-4 text-center">
          <p className={`text-2xl font-bold ${unknownWatts > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {unknownWatts}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Unknown Wattage</p>
        </div>
      </div>

      {unknownWatts > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-800">
          <ExclamationTriangleIcon className="w-5 h-5 shrink-0" />
          {unknownWatts} camera{unknownWatts !== 1 ? 's have' : ' has'} no power draw specified in their camera model.
          PoE totals for those cameras are excluded.
          <Link href="/camera-models" className="underline ml-1">Update models →</Link>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5 mb-6">
        {/* Per-switch PoE budget */}
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <ServerStackIcon className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-900">PoE by Switch</h2>
            <span className="ml-auto text-xs text-gray-400">Budget: {DEFAULT_POE_BUDGET_WATTS}W assumed</span>
          </div>
          {switchRows.length === 0 ? (
            <p className="text-sm text-gray-400 p-5">No switch data available.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-2 text-xs font-semibold text-gray-500">Switch</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Cameras</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Draw (W)</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500 w-36">Utilisation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {switchRows.map(row => {
                  const pct = (row.totalWatts / DEFAULT_POE_BUDGET_WATTS) * 100;
                  return (
                    <tr key={row.sw} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{row.sw}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{row.count}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{row.totalWatts}W</td>
                      <td className="px-4 py-3"><UtilBar pct={pct} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* VLAN summary */}
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <WifiIcon className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-900">VLAN Segmentation</h2>
          </div>
          {vlanRows.length === 0 ? (
            <p className="text-sm text-gray-400 p-5">No VLAN data available.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-2 text-xs font-semibold text-gray-500">VLAN</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Cameras</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Total Draw</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500 w-28">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {vlanRows.map(row => {
                  const pct = totalCameras > 0 ? (row.count / totalCameras) * 100 : 0;
                  return (
                    <tr key={row.vlan} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900 font-mono">{row.vlan}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{row.count}</td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {row.totalWatts > 0 ? `${row.totalWatts}W` : '—'}
                      </td>
                      <td className="px-4 py-3"><UtilBar pct={pct} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Per-site breakdown */}
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Per-Site Breakdown</h2>
      <div className="space-y-3">
        {sites.map(site => {
          const siteCameras = site.buildings.flatMap(b =>
            b.locations.flatMap(l => l.cameras)
          );
          const siteWatts = siteCameras.reduce(
            (s, c) => s + (c.model?.maxPowerWatts ? Number(c.model.maxPowerWatts) : 0), 0
          );

          return (
            <div key={site.id} className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
                <Link href={`/sites/${site.id}`} className="font-semibold text-gray-900 hover:text-blue-700">
                  {site.siteName}
                </Link>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{siteCameras.length} cameras</span>
                  <span className="font-medium text-gray-700">{siteWatts}W total draw</span>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-2 text-xs font-semibold text-gray-500">Building</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Cameras</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">PoE Draw</th>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-500 w-40">vs Budget</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {site.buildings.map(b => {
                    const bCameras = b.locations.flatMap(l => l.cameras);
                    const bWatts   = bCameras.reduce(
                      (s, c) => s + (c.model?.maxPowerWatts ? Number(c.model.maxPowerWatts) : 0), 0
                    );
                    const pct = (bWatts / DEFAULT_POE_BUDGET_WATTS) * 100;

                    return (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-gray-900">{b.buildingName}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{bCameras.length}</td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {bWatts > 0 ? `${bWatts}W` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {bWatts > 0
                            ? <UtilBar pct={pct} />
                            : <span className="text-xs text-gray-400">No data</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}

        {sites.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <WifiIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No sites found.</p>
          </div>
        )}
     
      </div>
    </div>
  );
}
