'use client';

import { useState } from 'react';
import {
  BuildingOfficeIcon, MapPinIcon, ChevronDownIcon,
} from '@heroicons/react/24/outline';

export interface BuildingEntry {
  id:           number;
  buildingName: string;
  locations:    { id: number; areaName: string | null; floor: string | null }[];
}

export function SiteBuildingsList({ buildings }: { buildings: BuildingEntry[] }) {
  const [openId, setOpenId] = useState<number | null>(null);

  if (buildings.length === 0) return <span className="text-gray-400">—</span>;

  return (
    <div className="w-60">
      <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
        <BuildingOfficeIcon className="w-3.5 h-3.5" />
        {buildings.length} building{buildings.length === 1 ? '' : 's'}
      </div>
      {/* Listbox restricted to a single row tall; remaining buildings scroll. */}
      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white max-h-8 overflow-y-auto">
        {buildings.map(b => {
          const open = openId === b.id;
          return (
            <div key={b.id}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : b.id)}
                className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left hover:bg-gray-50 transition-colors"
                title={open ? 'Hide survey locations' : 'Show survey locations'}
              >
                <span className="flex-1 min-w-0 truncate text-xs text-gray-700">{b.buildingName}</span>
                <span className="badge bg-indigo-50 text-indigo-600 text-xs shrink-0" title="Survey locations">
                  {b.locations.length}
                </span>
                <ChevronDownIcon
                  className={`w-3 h-3 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                />
              </button>
              {open && (
                <ul className="border-t border-gray-100 bg-gray-50/60 max-h-32 overflow-y-auto divide-y divide-gray-100">
                  {b.locations.length === 0 ? (
                    <li className="px-3 py-1.5 text-xs text-gray-400 italic">No survey locations yet</li>
                  ) : (
                    b.locations.map(l => (
                      <li key={l.id} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600">
                        <MapPinIcon className="w-3 h-3 text-gray-300 shrink-0" />
                        <span className="flex-1 min-w-0 truncate" title={l.areaName ?? undefined}>
                          {l.areaName || 'Unnamed location'}
                        </span>
                        {l.floor && <span className="text-gray-400 shrink-0">Fl {l.floor}</span>}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
