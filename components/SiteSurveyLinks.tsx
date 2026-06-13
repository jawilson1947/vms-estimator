'use client';

import { useState, useRef, useEffect } from 'react';
import {
  MapPinIcon, ArrowDownTrayIcon, MagnifyingGlassIcon,
  ChevronUpDownIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';

interface Props {
  sites: { id: number; siteName: string }[];
}

export function SiteSurveyLinks({ sites }: Props) {
  const [selectedSite, setSelectedSite] = useState<{ id: number; siteName: string } | null>(null);
  const [search, setSearch] = useState('');
  const [open,   setOpen]   = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = q ? sites.filter(s => s.siteName.toLowerCase().includes(q)) : sites;

  function pick(site: { id: number; siteName: string } | null) {
    setSelectedSite(site);
    setOpen(false);
    setSearch('');
  }

  return (
    <div className="card p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
          <MapPinIcon className="w-5 h-5 text-teal-600" />
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-50 text-red-700">PDF</span>
      </div>

      <div className="flex-1">
        <h2 className="font-semibold text-gray-900 mb-1">Site Survey</h2>
        <p className="text-sm text-gray-500">
          Per-site camera coverage report with compliance status, PoE totals, and firmware details.
        </p>
      </div>

      <div className="pt-3 border-t border-gray-100 space-y-2">
        <div ref={containerRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="form-input text-sm w-full flex items-center justify-between gap-2 text-left"
          >
            <span className={`truncate ${selectedSite ? 'text-gray-900' : 'text-gray-400'}`}>
              {selectedSite ? selectedSite.siteName : 'Select a site…'}
            </span>
            {selectedSite ? (
              <span
                role="button"
                title="Clear selection"
                onClick={e => { e.stopPropagation(); pick(null); }}
                className="shrink-0 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-4 h-4" />
              </span>
            ) : (
              <ChevronUpDownIcon className="w-4 h-4 text-gray-400 shrink-0" />
            )}
          </button>

          {open && (
            <div className="absolute z-20 left-0 right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-100 px-3 py-2">
                <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
                  <MagnifyingGlassIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <input
                    autoFocus value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search sites…"
                    className="flex-1 bg-transparent text-xs outline-none text-gray-700 placeholder-gray-400"
                  />
                </div>
              </div>
              {filtered.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pick(s)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs hover:bg-gray-50 transition-colors ${
                    selectedSite?.id === s.id ? 'bg-teal-50' : ''
                  }`}
                >
                  <MapPinIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="flex-1 min-w-0 truncate font-medium text-gray-900">{s.siteName}</span>
                  {selectedSite?.id === s.id && <CheckCircleSolid className="w-3.5 h-3.5 text-teal-500 shrink-0" />}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-4 py-4 text-xs text-gray-400 text-center">
                  {search ? 'No sites match your search.' : 'No sites yet.'}
                </p>
              )}
            </div>
          )}
        </div>

        <a
          href={selectedSite ? `/api/reports/site-survey/${selectedSite.id}` : '#'}
          download={!!selectedSite}
          onClick={e => { if (!selectedSite) e.preventDefault(); }}
          className={`btn-primary text-xs flex items-center gap-1.5 justify-center w-full ${
            !selectedSite ? 'opacity-40 cursor-not-allowed' : ''
          }`}
        >
          <ArrowDownTrayIcon className="w-3.5 h-3.5" />
          Download PDF
        </a>
      </div>
    </div>
  );
}
