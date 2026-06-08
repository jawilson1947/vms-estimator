'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { PlusIcon, MagnifyingGlassIcon, BuildingOfficeIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Building {
  id:           number;
  buildingName: string;
  siteId:       number;
  site:         { siteName: string; city: string | null; state: string | null };
  _count:       { locations: number };
}

interface Props {
  projectId:  number;
  excludeIds: number[];
  siteId?:    number;   // when set, only buildings from this site are shown
  label?:     string;
}

export function AddBuildingButton({ projectId, excludeIds, siteId, label }: Props) {
  const router  = useRouter();
  const [open, setOpen]         = useState(false);
  const [buildings, setBuildings] = useState<Building[]>([]);
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

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (modalBoxRef.current && !modalBoxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handleOutside), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handleOutside); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const url = siteId ? `/api/buildings?siteId=${siteId}` : '/api/buildings';
    fetch(url)
      .then(r => r.json())
      .then((data: Building[]) => setBuildings(data))
      .catch(() => setBuildings([]))
      .finally(() => setLoading(false));
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return buildings.filter(b =>
      !excludeSet.has(b.id) &&
      (b.buildingName.toLowerCase().includes(q) ||
       b.site.siteName.toLowerCase().includes(q) ||
       (b.site.city ?? '').toLowerCase().includes(q))
    );
  }, [buildings, search, excludeSet]);

  async function handleAssign() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/buildings`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ buildingId: selected }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Failed to assign building.');
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const modal = open && mounted && createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div ref={modalBoxRef} className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Assign Building</h2>
          <button onClick={() => setOpen(false)} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search buildings or sites..."
              className="form-input pl-9 text-sm"
            />
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 px-2 py-2">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              {search ? 'No buildings match your search.' : 'No buildings available.'}
            </p>
          ) : (
            filtered.map(b => (
              <button
                key={b.id}
                onClick={() => setSelected(b.id)}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors mb-0.5 ${
                  selected === b.id
                    ? 'bg-blue-50 border border-blue-300'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <BuildingOfficeIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{b.buildingName}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {b.site.siteName}
                    {(b.site.city || b.site.state) && (
                      <> &middot; {[b.site.city, b.site.state].filter(Boolean).join(', ')}</>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">{b._count.locations} camera location{b._count.locations !== 1 ? 's' : ''}</p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        {error && <p className="px-5 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
          <button
            onClick={handleAssign}
            disabled={!selected || saving}
            className="btn-primary"
          >
            {saving ? 'Assigning...' : 'Assign Building'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      <button
        onClick={() => { setOpen(true); setSelected(null); setSearch(''); setError(null); }}
        className="btn-secondary text-xs"
      >
        <PlusIcon className="w-3.5 h-3.5" />
        {label ?? 'Assign Building'}
      </button>
      {modal}
    </>
  );
}
