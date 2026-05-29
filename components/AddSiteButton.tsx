'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon, MagnifyingGlassIcon, MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Site {
  id: number;
  siteName: string;
  city: string | null;
  state: string | null;
  _count: { buildings: number };
}

interface Props {
  projectId: number;
  /** IDs of sites already on this project — excluded from the list */
  excludeIds: number[];
}

export function AddSiteButton({ projectId, excludeIds }: Props) {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [sites, setSites]     = useState<Site[]>([]);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Fetch unattached sites whenever dialog opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelected(null);
    setSearch('');
    // Fetch all sites with no project assigned
    fetch('/api/sites')
      .then(r => r.json())
      .then((all: Site[]) => {
        setSites(all.filter(s => !excludeIds.includes(s.id)));
      })
      .catch(() => setSites([]))
      .finally(() => setLoading(false));
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [open, excludeIds]);

  const q = search.toLowerCase();
  const visible = sites.filter(s =>
    !q ||
    s.siteName.toLowerCase().includes(q) ||
    (s.city  ?? '').toLowerCase().includes(q) ||
    (s.state ?? '').toLowerCase().includes(q)
  );

  async function attach() {
    if (selected === null) return;
    setSaving(true);
    try {
      // Fetch the full site first so we don't clobber other fields
      const siteRes = await fetch(`/api/sites/${selected}`);
      const site = await siteRes.json();
      await fetch(`/api/sites/${selected}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...site, projectId }),
      });
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1"
        >
          <PlusIcon className="w-3.5 h-3.5" /> Add Existing Site
        </button>
        <a
          href={`/sites/new?projectId=${projectId}`}
          className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1"
        >
          <PlusIcon className="w-3.5 h-3.5" /> New Site
        </a>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Add Existing Site</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
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
                  placeholder="Search sites…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>

            {/* Site list */}
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
              ) : visible.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  {sites.length === 0 ? 'No unattached sites found.' : 'No sites match your search.'}
                </p>
              ) : (
                visible.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelected(s.id === selected ? null : s.id)}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-colors mb-1 ${
                      selected === s.id
                        ? 'bg-blue-50 border border-blue-300'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <MapPinIcon className={`w-4 h-4 mt-0.5 shrink-0 ${selected === s.id ? 'text-blue-500' : 'text-gray-400'}`} />
                    <div>
                      <p className={`text-sm font-medium ${selected === s.id ? 'text-blue-800' : 'text-gray-900'}`}>
                        {s.siteName}
                      </p>
                      {(s.city || s.state) && (
                        <p className="text-xs text-gray-500">{[s.city, s.state].filter(Boolean).join(', ')}</p>
                      )}
                      <p className="text-xs text-gray-400">
                        {s._count.buildings} building{s._count.buildings !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
              <button
                onClick={attach}
                disabled={selected === null || saving}
                className="btn-primary flex-1 text-sm disabled:opacity-40"
              >
                {saving ? 'Adding…' : 'Add to Project'}
              </button>
              <button onClick={() => setOpen(false)} className="btn-secondary flex-1 text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
