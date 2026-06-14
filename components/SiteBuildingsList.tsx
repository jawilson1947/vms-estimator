'use client';

import { BuildingOfficeIcon } from '@heroicons/react/24/outline';

export interface BuildingEntry {
  id:           number;
  buildingName: string;
  locations:    { id: number; areaName: string | null; floor: string | null }[];
}

export function SiteBuildingsList({ buildings }: { buildings: BuildingEntry[] }) {
  if (buildings.length === 0) return <span className="text-gray-400">—</span>;

  return (
    <div className="w-60">
      <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
        <BuildingOfficeIcon className="w-3.5 h-3.5" />
        {buildings.length} building{buildings.length === 1 ? '' : 's'}
      </div>
      <select
        className="w-full border border-gray-200 rounded-lg bg-white px-2.5 py-1.5 text-xs text-gray-700"
        defaultValue=""
        aria-label="Buildings"
      >
        <option value="" disabled>
          {buildings.length} building{buildings.length === 1 ? '' : 's'}…
        </option>
        {buildings.map(b => (
          <option key={b.id} value={b.id}>
            {`${b.buildingName} (${b.locations.length} location${b.locations.length === 1 ? '' : 's'})`}
          </option>
        ))}
      </select>
    </div>
  );
}
