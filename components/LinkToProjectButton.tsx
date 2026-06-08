'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { PlusIcon, MagnifyingGlassIcon, FolderIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Project {
  id: number;
  projectName: string;
  projectNumber: string | null;
  projectStatus: string;
  customer: { customerName: string };
}

interface Props {
  siteId:     number;
  excludeIds: number[];   // project IDs already linked to this site
}

export function LinkToProjectButton({ siteId, excludeIds }: Props) {
  const router = useRouter();
  const [open, setOpen]         = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [mounted, setMounted]   = useState(false);
  const searchRef   = useRef<HTMLInputElement>(null);
  const modalBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const excludeKey = excludeIds.join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const excludeSet = useMemo(() => new Set(excludeIds), [excludeKey]);

  // Close on outside click, deferred one tick to skip the opening click.
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (modalBoxRef.current && !modalBoxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    const t = setTimeout(() => {
      document.addEventListener('mousedown', handleOutside);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelected(null);
    setSearch('');
    setError(null);
    fetch('/api/projects')
      .then(r => r.json())
      .then((all: Project[]) => {
        if (!Array.isArray(all)) throw new Error('bad response');
        setProjects(all.filter(p => !excludeSet.has(p.id)));
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
    setTimeout(() => searchRef.current?.focus(), 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, excludeKey]);

  const q       = search.toLowerCase();
  const visible = projects.filter(p =>
    !q ||
    p.projectName.toLowerCase().includes(q) ||
    (p.projectNumber ?? '').toLowerCase().includes(q) ||
    p.customer.customerName.toLowerCase().includes(q)
  );

  async function link() {
    if (selected === null) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${selected}/sites`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ siteId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Failed to link project (${res.status})`);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  const statusLabel: Record<string, string> = {
    PROPOSED: 'Proposed', APPROVED: 'Approved', IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed', ON_HOLD: 'On Hold', CANCELLED: 'Cancelled',
  };

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50">
      <div ref={modalBoxRef} className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Link to Project</h3>
          <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              {projects.length === 0 ? 'No projects available.' : 'No projects match your search.'}
            </p>
          ) : (
            visible.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id === selected ? null : p.id)}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-colors mb-1 ${
                  selected === p.id
                    ? 'bg-blue-50 border border-blue-300'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <FolderIcon className={`w-4 h-4 mt-0.5 shrink-0 ${selected === p.id ? 'text-blue-500' : 'text-gray-400'}`} />
                <div>
                  <p className={`text-sm font-medium ${selected === p.id ? 'text-blue-800' : 'text-gray-900'}`}>
                    {p.projectName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {p.customer.customerName}
                    {p.projectNumber && <span className="ml-1 text-gray-400">· {p.projectNumber}</span>}
                  </p>
                  <p className="text-xs text-gray-400">{statusLabel[p.projectStatus] ?? p.projectStatus}</p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="mx-5 mb-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={link}
            disabled={selected === null || saving}
            className="btn-primary flex-1 text-sm disabled:opacity-40"
          >
            {saving ? 'Linking...' : 'Link to Project'}
          </button>
          <button type="