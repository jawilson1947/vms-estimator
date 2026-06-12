'use client';

import { useState, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, XMarkIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';

export interface AccessMethodOption {
  id:       number;
  name:     string;
  grouping: string | null;
  items: {
    artifactTypeId: number;
    quantity:       number;
    notes:          string | null;
    artifactType:   { id: number; name: string };
  }[];
}

export function methodItemSummary(m: AccessMethodOption) {
  return m.items
    .map(i => (i.quantity > 1 ? `${i.artifactType.name} ×${i.quantity}` : i.artifactType.name))
    .join(', ') || 'No default equipment';
}

const GROUP_ORDER = ['Internal', 'External', 'Other'];

interface AccessMethodPickerProps {
  assignedMethod: { id: number; name: string } | null;
  methods:        AccessMethodOption[];
  loading:        boolean;
  onAssign:       (methodId: number | null) => Promise<void> | void;
  assigning:      boolean;
}

export function AccessMethodPicker({ assignedMethod, methods, loading, onAssign, assigning }: AccessMethodPickerProps) {
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

  const q = search.toLowerCase();
  const filtered = methods.filter(m =>
    !q ||
    m.name.toLowerCase().includes(q) ||
    (m.grouping ?? '').toLowerCase().includes(q) ||
    m.items.some(i => i.artifactType.name.toLowerCase().includes(q))
  );

  const assignedFull = assignedMethod ? methods.find(m => m.id === assignedMethod.id) ?? null : null;

  async function pick(methodId: number | null) { setOpen(false); setSearch(''); await onAssign(methodId); }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 mb-2">
        {assignedMethod ? (
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-fuchsia-50 border border-fuchsia-200 rounded-lg">
            <LockClosedIcon className="w-4 h-4 text-fuchsia-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-fuchsia-800 truncate">{assignedMethod.name}</p>
              {assignedFull && (
                <p className="text-xs text-fuchsia-500 truncate">{methodItemSummary(assignedFull)}</p>
              )}
            </div>
            <button onClick={() => pick(null)} disabled={assigning} className="shrink-0 text-fuchsia-400 hover:text-red-500 transition-colors disabled:opacity-40" title="Remove access method">
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic flex-1">No access method set</p>
        )}
        <button
          onClick={() => setOpen(o => !o)}
          disabled={assigning || loading}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-fuchsia-600 border border-fuchsia-200 rounded-lg hover:bg-fuchsia-50 transition-colors disabled:opacity-40 shrink-0"
        >
          {assigning ? <span className="w-3 h-3 border border-fuchsia-500 border-t-transparent rounded-full animate-spin" /> : <LockClosedIcon className="w-3.5 h-3.5" />}
          {assignedMethod ? 'Change' : 'Select'}
        </button>
      </div>

      {open && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-100 px-3 py-2">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
              <MagnifyingGlassIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search door types…"
                className="flex-1 bg-transparent text-xs outline-none text-gray-700 placeholder-gray-400"
              />
            </div>
          </div>
          {assignedMethod && (
            <button onClick={() => pick(null)} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 transition-colors border-b border-gray-50">
              <XMarkIcon className="w-3.5 h-3.5" />Remove access method
            </button>
          )}
          {GROUP_ORDER.map(group => {
            const grouped = filtered.filter(m => (m.grouping ?? 'Other') === group);
            if (grouped.length === 0) return null;
            return (
              <div key={group}>
                <p className="px-4 pt-2.5 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">{group}</p>
                {grouped.map(m => (
                  <button key={m.id} onClick={() => pick(m.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${assignedMethod?.id === m.id ? 'bg-fuchsia-50' : ''}`}
                  >
                    <LockClosedIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{m.name}</p>
                      <p className="text-xs text-gray-400 truncate">{methodItemSummary(m)}</p>
                    </div>
                    {assignedMethod?.id === m.id && <CheckCircleSolid className="w-3.5 h-3.5 text-fuchsia-500 shrink-0" />}
                  </button>
                ))}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-4 py-4 text-xs text-gray-400 text-center">
              {search ? 'No access methods match your search.' : 'No access methods defined yet.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
