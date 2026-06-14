'use client';

import { MapPinIcon } from '@heroicons/react/24/outline';

export interface LocationEntry {
  id:       number;
  areaName: string | null;
  floor:    string | null;
}

export function ProjectLocationsList({ locations, className = 'w-52' }: { locations: LocationEntry[]; className?: string }) {
  if (locations.length === 0) return <span className="text-gray-400">—</span>;

  return (
    <div className={className}>
      <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
        <MapPinIcon className="w-3.5 h-3.5" />
        {locations.length} location{locations.length === 1 ? '' : 's'}
      </div>
      <select
        className="w-full border border-gray-200 rounded-lg bg-white px-2.5 py-1.5 text-xs text-gray-600"
        defaultValue=""
        aria-label="Survey locations"
      >
        <option value="" disabled>
          {locations.length} location{locations.length === 1 ? '' : 's'}…
        </option>
        {locations.map(l => (
          <option key={l.id} value={l.id}>
            {(l.areaName || 'Unnamed location') + (l.floor ? ` — Fl ${l.floor}` : '')}
          </option>
        ))}
      </select>
    </div>
  );
}
