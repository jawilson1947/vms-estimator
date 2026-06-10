'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TrashIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

interface Props {
  buildingId:   number;
  buildingName: string;
}

export function BuildingActions({ buildingId, buildingName }: Props) {
  const router = useRouter();
  const [mode,   setMode]   = useState<'idle' | 'confirm-delete'>('idle');
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

  if (mode === 'confirm-delete') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-600 font-medium">Delete "{buildingName}"?</span>
        <button
          onClick={handleDelete}
          disabled={saving}
          className="text-xs bg-red-600 text-white px-2.5 py-1 rounded hover:bg-red-700 disabled:opacity-40"
        >
          {saving ? 'Deleting…' : 'Yes, delete'}
        </button>
        <button
          onClick={() => { setMode('idle'); setError(''); }}
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
      <Link
        href={`/buildings/${buildingId}`}
        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
        title="View building"
      >
        <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
      </Link>
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
