'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PencilIcon, TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Props {
  buildingId: number;
  buildingName: string;
}

export function BuildingActions({ buildingId, buildingName }: Props) {
  const router = useRouter();
  const [mode,   setMode]   = useState<'idle' | 'edit' | 'confirm-delete'>('idle');
  const [name,   setName]   = useState(buildingName);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  async function parseError(res: Response, fallback: string): Promise<string> {
    try {
      const text = await res.text();
      if (!text) return fallback;
      const j = JSON.parse(text);
      return j.error ?? fallback;
    } catch {
      return fallback;
    }
  }

  async function handleRename() {
    if (!name.trim() || name.trim() === buildingName) { setMode('idle'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/buildings/${buildingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildingName: name.trim() }),
      });
      if (!res.ok) { setError(await parseError(res, 'Save failed')); return; }
      setMode('idle');
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      const res = await fetch(`/api/buildings/${buildingId}`, { method: 'DELETE' });
      if (!res.ok) { setError(await parseError(res, 'Delete failed')); return; }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (mode === 'edit') {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setMode('idle'); }}
          className="input-field text-sm py-1 px-2 w-48"
          autoFocus
        />
        <button
          onClick={handleRename}
          disabled={saving}
          className="w-7 h-7 flex items-center justify-center rounded text-green-600 hover:bg-green-50 disabled:opacity-40"
          title="Save"
        >
          <CheckIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setMode('idle'); setName(buildingName); setError(''); }}
          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100"
          title="Cancel"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    );
  }

  if (mode === 'confirm-delete') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-600 font-medium">Delete this building?</span>
        <button
          onClick={handleDelete}
          disabled={saving}
          className="text-xs bg-red-600 text-white px-2.5 py-1 rounded hover:bg-red-700 disabled:opacity-40"
        >
          {saving ? 'Deleting…' : 'Yes, delete'}
        </button>
        <button
          onClick={() => setMode('idle')}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={() => setMode('edit')}
        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
        title="Rename building"
      >
        <PencilIcon className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => { setMode('confirm-delete'); setError(''); }}
        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
        title="Delete building"
      >
        <TrashIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
