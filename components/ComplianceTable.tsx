'use client';

import { useState, useMemo } from 'react';
import {
  CheckCircleIcon, XCircleIcon, MagnifyingGlassIcon,
  FunnelIcon, ShieldCheckIcon, ShieldExclamationIcon,
} from '@heroicons/react/24/outline';

interface CameraRow {
  id: number;
  cameraCode: string;
  cameraName: string | null;
  status: string;
  ipAddress: string | null;
  firmwareVersion: string | null;
  httpsEnabled: boolean | null;
  usernameChanged: boolean | null;
  privacyMaskEnabled: boolean | null;
  installDate: string | null;
  warrantyExpiration: string | null;
  location: {
    areaName: string | null;
    building: {
      buildingName: string;
      site: {
        siteName: string;
        customer: { customerName: string } | null;
      };
    } | null;
  } | null;
}

interface Props { cameras: CameraRow[] }

type FilterMode = 'all' | 'issues' | 'no-https' | 'default-user' | 'no-mask';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:       'bg-green-50 text-green-700',
  INSTALLED:    'bg-blue-50 text-blue-700',
  OFFLINE:      'bg-red-50 text-red-700',
  NEEDS_REPAIR: 'bg-amber-50 text-amber-700',
  PLANNED:      'bg-gray-100 text-gray-600',
  RETIRED:      'bg-gray-100 text-gray-400',
};

function Bool({ val }: { val: boolean | null }) {
  if (val === true)  return <CheckCircleIcon className="w-4 h-4 text-green-500 mx-auto" />;
  if (val === false) return <XCircleIcon     className="w-4 h-4 text-red-500 mx-auto"   />;
  return <span className="text-gray-300 text-xs mx-auto block text-center">—</span>;
}

export function ComplianceTable({ cameras }: Props) {
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<FilterMode>('all');
  const [site,   setSite]     = useState('');

  const sites = useMemo(() => {
    const set = new Set<string>();
    cameras.forEach(c => {
      const s = c.location?.building?.site?.siteName;
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [cameras]);

  const filtered = useMemo(() => {
    return cameras.filter(c => {
      // Site filter
      if (site) {
        const s = c.location?.building?.site?.siteName ?? '';
        if (s !== site) return false;
      }

      // Text search
      if (search) {
        const q = search.toLowerCase();
        const haystack = [
          c.cameraCode, c.cameraName,
          c.ipAddress, c.firmwareVersion,
          c.location?.building?.site?.siteName,
          c.location?.building?.buildingName,
          c.location?.areaName,
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      // Compliance filter
      switch (filter) {
        case 'issues':       return !c.httpsEnabled || !c.usernameChanged;
        case 'no-https':     return !c.httpsEnabled;
        case 'default-user': return !c.usernameChanged;
        case 'no-mask':      return !c.privacyMaskEnabled;
        default:             return true;
      }
    });
  }, [cameras, search, filter, site]);

  const filterButtons: { key: FilterMode; label: string; count: number }[] = [
    { key: 'all',          label: 'All',             count: cameras.length },
    { key: 'issues',       label: 'Has Issues',      count: cameras.filter(c => !c.httpsEnabled || !c.usernameChanged).length },
    { key: 'no-https',     label: 'No HTTPS',        count: cameras.filter(c => !c.httpsEnabled).length },
    { key: 'default-user', label: 'Default Username',count: cameras.filter(c => !c.usernameChanged).length },
    { key: 'no-mask',      label: 'No Privacy Mask', count: cameras.filter(c => !c.privacyMaskEnabled).length },
  ];

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search cameras…"
            className="input-field pl-9 text-sm w-full"
          />
        </div>

        {/* Site filter */}
        <div className="relative">
          <FunnelIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            value={site}
            onChange={e => setSite(e.target.value)}
            className="input-field pl-9 text-sm pr-8"
          >
            <option value="">All Sites</option>
            {sites.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {filterButtons.map(btn => (
          <button
            key={btn.key}
            onClick={() => setFilter(btn.key)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              filter === btn.key
                ? btn.key === 'all'
                  ? 'bg-gray-800 text-white'
                  : 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {btn.label}
            <span className={`ml-1.5 text-xs ${filter === btn.key ? 'opacity-80' : 'text-gray-400'}`}>
              {btn.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Camera</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Site / Location</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">IP Address</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">HTTPS</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">User Changed</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Privacy Mask</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Compliant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                    No cameras match the current filters.
                  </td>
                </tr>
              ) : filtered.map(c => {
                const compliant = !!c.httpsEnabled && !!c.usernameChanged;
                const site = c.location?.building?.site?.siteName ?? '';
                const bldg = c.location?.building?.buildingName ?? '';
                const area = c.location?.areaName ?? '';
                return (
                  <tr key={c.id} className={`hover:bg-gray-50 ${!compliant ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.cameraCode}</p>
                      {c.cameraName && <p className="text-xs text-gray-400">{c.cameraName}</p>}
                      {c.firmwareVersion && (
                        <p className="text-xs text-gray-400">FW: {c.firmwareVersion}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{site}</p>
                      <p className="text-xs text-gray-400">{[bldg, area].filter(Boolean).join(' / ')}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {c.ipAddress ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {c.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Bool val={c.httpsEnabled} />
                    </td>
                    <td className="px-3 py-3">
                      <Bool val={c.usernameChanged} />
                    </td>
                    <td className="px-3 py-3">
                      <Bool val={c.privacyMaskEnabled} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      {compliant
                        ? <ShieldCheckIcon     className="w-4 h-4 text-green-500 mx-auto" />
                        : <ShieldExclamationIcon className="w-4 h-4 text-red-500 mx-auto" />
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400">
            Showing {filtered.length} of {cameras.length} cameras
          </div>
        )}
      </div>
    </div>
  );
}
