import Link from 'next/link';
import { MapPinIcon, BuildingOffice2Icon, CameraIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CameraModelSlim {
  id: number;
  manufacturer: string | null;
  model: string | null;
  cost: unknown;         // Decimal from Prisma — convert with Number()
  cameraType: string | null;
}

interface Location {
  id: number;
  areaName: string | null;
  floor: string | null;
  cameraModel: CameraModelSlim | null;
}

interface Building {
  id: number;
  buildingName: string;
  locations: Location[];
}

interface Site {
  id: number;
  siteName: string;
  city: string | null;
  state: string | null;
  buildings: Building[];
}

interface ManualCost {
  id: number;
  description: string | null;
  quantity: unknown;
  unitCost: unknown;
  markupPercent: unknown;
  lineTotal: unknown;
  category: { name: string };
}

interface Props {
  projectId: number;
  site: Site | null;
  manualCosts: ManualCost[];
  readOnly?: boolean; // restricted viewers: hide the "Manage costs" link
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProjectScopePanel({ projectId, site, manualCosts, readOnly }: Props) {
  // Compute survey-derived totals
  const sites = site ? [site] : [];
  const allLocations = sites.flatMap(s => s.buildings.flatMap(b => b.locations));
  const surveyTotal = allLocations.reduce(
    (sum, loc) => sum + Number(loc.cameraModel?.cost ?? 0),
    0
  );
  const manualTotal = manualCosts.reduce(
    (sum, c) => sum + Number(c.lineTotal ?? 0),
    0
  );
  const scopeTotal = surveyTotal + manualTotal;

  const hasLocations = allLocations.length > 0;

  return (
    <div className="card overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">Project Scope</h2>
        {!readOnly && (
          <Link href={`/costs?projectId=${projectId}`} className="text-xs text-blue-600 hover:underline">
            Manage costs →
          </Link>
        )}
      </div>

      {/* ── Survey Locations ─────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-3">
          <CameraIcon className="w-4 h-4 text-gray-400" />
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Survey Locations
          </h3>
        </div>

        {sites.length === 0 ? (
          <p className="text-sm text-gray-400 mb-4">No sites linked to this project.</p>
        ) : !hasLocations ? (
          <p className="text-sm text-gray-400 mb-4">
            No locations surveyed yet — open a site survey to add camera locations.
          </p>
        ) : (
          <div className="space-y-4 mb-4">
            {sites.map(site => {
              const siteLocations = site.buildings.flatMap(b => b.locations);
              if (siteLocations.length === 0) return null;

              const siteCameraTotal = siteLocations.reduce(
                (sum, loc) => sum + Number(loc.cameraModel?.cost ?? 0),
                0
              );

              return (
                <div key={site.id}>
                  {/* Site header */}
                  <div className="flex items-center gap-2 mb-2">
                    <MapPinIcon className="w-4 h-4 text-teal-500 shrink-0" />
                    <span className="text-sm font-semibold text-gray-800">
                      {site.siteName}
                    </span>
                    {(site.city || site.state) && (
                      <span className="text-xs text-gray-400">
                        {[site.city, site.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-gray-500">
                      {siteLocations.length} camera{siteLocations.length !== 1 ? 's' : ''}
                      {siteCameraTotal > 0 && <> · {fmt(siteCameraTotal)}</>}
                    </span>
                  </div>

                  {/* Buildings */}
                  <div className="pl-5 space-y-3">
                    {site.buildings.map(building => {
                      if (building.locations.length === 0) return null;

                      return (
                        <div key={building.id}>
                          {/* Building header */}
                          <div className="flex items-center gap-1.5 mb-1">
                            <BuildingOffice2Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="text-xs font-medium text-gray-600">
                              {building.buildingName}
                            </span>
                          </div>

                          {/* Location table */}
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-100">
                                <th className="text-left py-1.5 pl-4 pr-2 font-medium text-gray-500">Area</th>
                                <th className="text-left py-1.5 px-2 font-medium text-gray-500">Floor</th>
                                <th className="text-left py-1.5 px-2 font-medium text-gray-500">Camera Model</th>
                                <th className="text-right py-1.5 pl-2 pr-4 font-medium text-gray-500">Unit Cost</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {building.locations.map(loc => {
                                const modelLabel = loc.cameraModel
                                  ? [loc.cameraModel.manufacturer, loc.cameraModel.model]
                                      .filter(Boolean).join(' ')
                                  : null;
                                const cost = Number(loc.cameraModel?.cost ?? 0);

                                return (
                                  <tr key={loc.id} className="hover:bg-gray-50">
                                    <td className="py-1.5 pl-4 pr-2 text-gray-700">
                                      {loc.areaName || <span className="text-gray-400 italic">Unnamed</span>}
                                    </td>
                                    <td className="py-1.5 px-2 text-gray-500">
                                      {loc.floor || '—'}
                                    </td>
                                    <td className="py-1.5 px-2 text-gray-700">
                                      {modelLabel ? (
                                        <>
                                          {modelLabel}
                                          {loc.cameraModel?.cameraType && (
                                            <span className="ml-1 text-gray-400">
                                              ({loc.cameraModel.cameraType})
                                            </span>
                                          )}
                                        </>
                                      ) : (
                                        <span className="text-gray-400 italic">Unassigned</span>
                                      )}
                                    </td>
                                    <td className="py-1.5 pl-2 pr-4 text-right text-gray-700">
                                      {cost > 0 ? fmt(cost) : <span className="text-gray-400">—</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Survey subtotal */}
        {hasLocations && (
          <div className="flex justify-between items-center py-2 border-t border-gray-100 text-sm">
            <span className="text-gray-500">
              Survey subtotal ({allLocations.length} location{allLocations.length !== 1 ? 's' : ''})
            </span>
            <span className="font-medium text-gray-700">{fmt(surveyTotal)}</span>
          </div>
        )}
      </div>

      {/* ── Manual Cost Line Items ────────────────────────────────── */}
      {manualCosts.length > 0 && (
        <>
          <div className="border-t border-gray-200 px-5 pt-4 pb-2">
            <div className="flex items-center gap-2 mb-3">
              <CurrencyDollarIcon className="w-4 h-4 text-gray-400" />
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Cost Line Items
              </h3>
            </div>

            <table className="w-full text-xs mb-2">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-1.5 pr-2 font-medium text-gray-500">Category</th>
                  <th className="text-left py-1.5 px-2 font-medium text-gray-500">Description</th>
                  <th className="text-right py-1.5 px-2 font-medium text-gray-500">Qty</th>
                  <th className="text-right py-1.5 px-2 font-medium text-gray-500">Unit Cost</th>
                  <th className="text-right py-1.5 pl-2 pr-4 font-medium text-gray-500">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {manualCosts.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="py-1.5 pr-2">
                      <span className="badge bg-gray-100 text-gray-600 text-xs">
                        {c.category.name}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-gray-700">
                      {c.description || <span className="text-gray-400 italic">—</span>}
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-600">
                      {Number(c.quantity)}
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-600">
                      {fmt(Number(c.unitCost))}
                    </td>
                    <td className="py-1.5 pl-2 pr-4 text-right font-medium text-gray-900">
                      {fmt(Number(c.lineTotal ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between items-center py-2 border-t border-gray-100 text-sm">
              <span className="text-gray-500">
                Cost line items subtotal ({manualCosts.length} item{manualCosts.length !== 1 ? 's' : ''})
              </span>
              <span className="font-medium text-gray-700">{fmt(manualTotal)}</span>
            </div>
          </div>
        </>
      )}

      {/* ── Combined Scope Total ──────────────────────────────────── */}
      {(hasLocations || manualCosts.length > 0) && (
        <div className="border-t-2 border-gray-200 bg-gray-50 px-5 py-3 flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-700">Scope Total</span>
          <span className="text-base font-bold text-blue-700">{fmt(scopeTotal)}</span>
        </div>
      )}
    </div>
  );
}
