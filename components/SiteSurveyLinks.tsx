'use client';

import { useState } from 'react';
import { MapPinIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface Props {
  sites: { id: number; siteName: string }[];
}

export function SiteSurveyLinks({ sites }: Props) {
  const [selectedSite, setSelectedSite] = useState('');

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
        <select
          value={selectedSite}
          onChange={e => setSelectedSite(e.target.value)}
          className="input-field text-sm w-full"
        >
          <option value="">Select a site…</option>
          {sites.map(s => (
            <option key={s.id} value={String(s.id)}>{s.siteName}</option>
          ))}
        </select>

        <a
          href={selectedSite ? `/api/reports/site-survey/${selectedSite}` : '#'}
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
