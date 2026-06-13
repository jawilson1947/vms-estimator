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
      {/* Listbox restricted to a single row tall; remaining locations scroll. */}
      <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white max-h-8 overflow-y-auto">
        {locations.map(l => (
          <li key={l.id} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600">
            <span className="flex-1 min-w-0 truncate" title={l.areaName ?? undefined}>
              {l.areaName || 'Unnamed location'}
            </span>
            {l.floor && <span className="text-gray-400 shrink-0">Fl {l.floor}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
