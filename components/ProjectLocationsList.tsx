'use client';

import { useState } from 'react';
import { MapPinIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const PAGE_SIZE = 6;

export interface LocationEntry {
  id:       number;
  areaName: string | null;
  floor:    string | null;
}

export function ProjectLocationsList({ locations, className = 'w-52' }: { locations: LocationEntry[]; className?: string }) {
  const [page, setPage] = useState(1);

  if (locations.length === 0) return <span className="text-gray-400">—</span>;

  const totalPages  = Math.max(1, Math.ceil(locations.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows    = locations.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className={className}>
      <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
        <MapPinIcon className="w-3.5 h-3.5" />
        {locations.length} location{locations.length === 1 ? '' : 's'}
      </div>
      <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white">
        {pageRows.map(l => (
          <li key={l.id} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600">
            <span className="flex-1 min-w-0 truncate" title={l.areaName ?? undefined}>
              {l.areaName || 'Unnamed location'}
            </span>
            {l.floor && <span className="text-gray-400 shrink-0">Fl {l.floor}</span>}
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-1 text-xs text-gray-400">
          <button
            type="button"
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-0.5 rounded hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Previous locations"
          >
            <ChevronLeftIcon className="w-3.5 h-3.5" />
          </button>
          <span className="tabular-nums">{currentPage} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-0.5 rounded hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Next locations"
          >
            <ChevronRightIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
