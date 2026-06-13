'use client';

import { useState } from 'react';
import {
  BuildingOfficeIcon, MapPinIcon,
  ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon,
} from '@heroicons/react/24/outline';

const PAGE_SIZE = 6;

export interface BuildingEntry {
  id:           number;
  buildingName: string;
  locations:    { id: number; areaName: string | null; floor: string | null }[];
}

export function SiteBuildingsList({ buildings }: { buildings: BuildingEntry[] }) {
  const [page,   setPage]   = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);

  if (buildings.length === 0) return <span className="text-gray-400">—</span>;

  const totalPages  = Math.max(1, Math.ceil(buildings.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows    = buildings.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="w-60">
      <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
        <BuildingOfficeIcon className="w-3.5 h-3.5" />
        {buildings.length} building{buildings.length === 1 ? '' : 's'}
      </div>
      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white">
        {pageRows.map(b => {
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-1 text-xs text-gray-400">
          <button
            type="button"
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-0.5 rounded hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Previous buildings"
          >
            <ChevronLeftIcon className="w-3.5 h-3.5" />
          </button>
          <span className="tabular-nums">{currentPage} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-0.5 rounded hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Next buildings"
          >
            <ChevronRightIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
