'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MagnifyingGlassIcon, FunnelIcon,
  ChevronLeftIcon, ChevronRightIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';

interface LogEntry {
  id: number;
  userId: number | null;
  userEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: number | null;
  detail: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { username: string; firstName: string | null; lastName: string | null } | null;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE:  'bg-green-50 text-green-700',
  UPDATE:  'bg-blue-50 text-blue-700',
  DELETE:  'bg-red-50 text-red-700',
  LOGIN:   'bg-indigo-50 text-indigo-700',
  LOGOUT:  'bg-gray-100 text-gray-600',
  EXPORT:  'bg-amber-50 text-amber-700',
};

function actionColor(action: string) {
  const key = Object.keys(ACTION_COLORS).find(k => action.toUpperCase().startsWith(k));
  return key ? ACTION_COLORS[key] : 'bg-gray-100 text-gray-600';
}

export function AuditLogViewer() {
  const [logs,     setLogs]     = useState<LogEntry[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [entity,   setEntity]   = useState('');
  const LIMIT = 50;

  const load = useCallback(async (p: number, q: string, ent: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page:  String(p),
        limit: String(LIMIT),
      });
      if (q)   params.set('action', q);
      if (ent) params.set('entity', ent);

      const res = await fetch(`/api/admin/audit?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page, search, entity); }, [load, page, search, entity]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };
  const handleEntity = (v: string) => {
    setEntity(v);
    setPage(1);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Filter by action…"
            className="input-field pl-9 text-sm w-full"
          />
        </div>
        <div className="relative">
          <FunnelIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            value={entity}
            onChange={e => handleEntity(e.target.value)}
            className="input-field pl-9 text-sm pr-8"
          >
            <option value="">All Entities</option>
            <option value="User">User</option>
            <option value="Camera">Camera</option>
            <option value="Project">Project</option>
            <option value="Customer">Customer</option>
            <option value="Site">Site</option>
            <option value="Report">Report</option>
          </select>
        </div>
        <button
          onClick={() => load(page, search, entity)}
          className="btn-secondary text-xs flex items-center gap-1.5"
        >
          <ArrowPathIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 w-36">Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Entity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Detail</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 w-28">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                    Loading…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                    No audit log entries found.
                  </td>
                </tr>
              ) : logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {format(new Date(log.createdAt), 'MMM d, HH:mm:ss')}
                  </td>
                  <td className="px-4 py-3">
                    {log.user ? (
                      <div>
                        <p className="text-gray-700 text-xs font-medium">{log.user.username}</p>
                        <p className="text-gray-400 text-xs">{log.userEmail}</p>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">{log.userEmail ?? 'System'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge text-xs ${actionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {log.entityType ? (
                      <span>
                        {log.entityType}
                        {log.entityId ? <span className="text-gray-400"> #{log.entityId}</span> : null}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                    {log.detail ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">
                    {log.ipAddress ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>{total} entries</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
